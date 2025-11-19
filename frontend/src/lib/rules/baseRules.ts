/**
 * Base Rule Engine (TR-RU-501)
 *
 * Implements the core compensation evaluation logic based on:
 * - EU Regulation 2021/782 (Railway Passenger Rights)
 * - Norwegian railway passenger rights (simplified MVP version)
 *
 * This is a pure function-based rule engine that can be easily tested
 * and extended with operator-specific overrides (TR-RU-502).
 */

import {
  RuleInput,
  RuleOutcome,
  EligibilityStatus,
  CompensationConfig,
} from './types';

/**
 * Default compensation configuration (MVP)
 *
 * Based on simplified EU/Norwegian railway passenger rights:
 * - < 60 min: No compensation
 * - 60-119 min: 25% of ticket price
 * - >= 120 min: 50% of ticket price
 *
 * These values can be adjusted later based on:
 * - Distance bands (SHORT/MEDIUM/LONG)
 * - Operator-specific policies
 * - Updated legal requirements
 */
export const DEFAULT_COMPENSATION_CONFIG: CompensationConfig = {
  minDelayMinutes: 60,
  tier1DelayMinutes: 60,
  tier1Pct: 25,
  tier2DelayMinutes: 120,
  tier2Pct: 50,
};

/**
 * Evaluate base compensation for a delay claim
 *
 * This is the main entry point for the rule engine. It applies a
 * decision tree based on delay status, force majeure, and delay duration.
 *
 * NOTE: This function implements the BASE rules that apply to all operators.
 * For operator-specific overrides (TR-RU-502), create a wrapper function like:
 *   evaluateWithOperatorOverrides(input) {
 *     // 1. Check if operator-specific rules exist for input.operatorCode
 *     // 2. If yes, apply operator rules (may call this function for base logic)
 *     // 3. If no, fall back to evaluateBaseCompensation(input)
 *   }
 *
 * @param input - Consolidated input with ticket, journey, and delay data
 * @param config - Compensation thresholds (optional, uses defaults if not provided)
 * @returns Rule outcome with eligibility, percentage, and explanations
 */
export function evaluateBaseCompensation(
  input: RuleInput,
  config: CompensationConfig = DEFAULT_COMPENSATION_CONFIG
): RuleOutcome {
  const { ticket, journey, delay, isForceMajeure, operatorCode } = input;

  // TODO(TR-RU-502): Hook for operator-specific rules
  // This is where operator-specific overrides will be checked before applying base rules.
  // Example: if (operatorCode === 'VY') { return evaluateVyRules(input); }

  // Debug information
  const debug: RuleOutcome['debug'] = {
    operatorCode: operatorCode || ticket.operator,
    trainNumber: ticket.trainNumber,
    delayStatus: delay.status,
  };

  // Rule 1: Unknown delay status
  if (delay.status === 'UNKNOWN') {
    return {
      status: 'UNKNOWN',
      compensationPct: 0,
      legalBasis: [],
      reasons: [
        'Forsinkelsen kunne ikke beregnes.',
        'Vennligst sjekk togets faktiske avgangstid manuelt.',
      ],
      debug: {
        ...debug,
        appliedRule: 'UNKNOWN_DELAY',
      },
    };
  }

  // Rule 2: Cancelled journey
  // NOTE (TR-RU-503): Cancelled journeys are now handled at the entry point (index.ts)
  // with 100% refund regardless of force majeure. This code should never be reached
  // for cancelled journeys, but is kept for backwards compatibility if called directly.
  if (delay.status === 'CANCELLED') {
    // DEPRECATED: This logic is incorrect per TR-RU-503
    // Cancelled journeys should ALWAYS give 100% refund, not 50% or 0%
    // See evaluateClaimFromDomainModels() in index.ts for correct implementation
    if (isForceMajeure || journey.forceMajeureFlag) {
      return {
        status: 'NOT_ELIGIBLE',
        compensationPct: 0,
        legalBasis: ['EU_2021_782_art19_force_majeure'],
        reasons: [
          'Toget ble innstilt på grunn av force majeure.',
          'Etter jernbanepassasjer-rettigheter gis det ikke erstatning for innstillinger forårsaket av ekstraordinære omstendigheter.',
        ],
        debug: {
          ...debug,
          forceMajeure: true,
          appliedRule: 'CANCELLED_FORCE_MAJEURE_DEPRECATED',
        },
      };
    }

    // Cancelled without force majeure → eligible for compensation
    return {
      status: 'ELIGIBLE',
      compensationPct: config.tier2Pct, // DEPRECATED: Should be 100% per TR-RU-503
      legalBasis: ['EU_2021_782_art19', 'NO_jernbane_passasjerrett'],
      reasons: [
        `Toget ble innstilt.`,
        `Du har krav på ${config.tier2Pct}% erstatning av billettpris.`,
      ],
      debug: {
        ...debug,
        forceMajeure: false,
        appliedRule: 'CANCELLED_NO_FORCE_MAJEURE_DEPRECATED',
      },
    };
  }

  // Rule 3: Force majeure (non-cancelled)
  if (isForceMajeure || journey.forceMajeureFlag) {
    return {
      status: 'NOT_ELIGIBLE',
      compensationPct: 0,
      legalBasis: ['EU_2021_782_art19_force_majeure'],
      reasons: [
        'Forsinkelsen skyldes force majeure (ekstraordinære omstendigheter).',
        'Etter jernbanepassasjer-rettigheter gis det ikke erstatning i slike tilfeller.',
      ],
      debug: {
        ...debug,
        forceMajeure: true,
        appliedRule: 'FORCE_MAJEURE',
      },
    };
  }

  // Rule 4: Determine delay minutes
  // Use arrival delay as primary, fall back to departure delay
  const delayMinutes =
    delay.arrivalDelayMinutes !== undefined
      ? delay.arrivalDelayMinutes
      : delay.departureDelayMinutes !== undefined
        ? delay.departureDelayMinutes
        : 0;

  debug.delayMinutes = delayMinutes;

  // Rule 5: Delay below minimum threshold
  if (delayMinutes < config.minDelayMinutes) {
    return {
      status: 'NOT_ELIGIBLE',
      compensationPct: 0,
      legalBasis: ['EU_2021_782_art19'],
      reasons: [
        `Forsinkelsen er ${delayMinutes} minutter.`,
        `Minstekravet for erstatning er ${config.minDelayMinutes} minutter.`,
      ],
      debug: {
        ...debug,
        appliedRule: 'BELOW_MINIMUM',
      },
    };
  }

  // Rule 6: Tier 2 compensation (high delay)
  if (delayMinutes >= config.tier2DelayMinutes) {
    return {
      status: 'ELIGIBLE',
      compensationPct: config.tier2Pct,
      legalBasis: ['EU_2021_782_art19', 'NO_jernbane_passasjerrett'],
      reasons: [
        `Forsinkelsen er ${delayMinutes} minutter.`,
        `Du har krav på ${config.tier2Pct}% erstatning av billettpris.`,
      ],
      debug: {
        ...debug,
        appliedRule: 'TIER2_HIGH_DELAY',
      },
    };
  }

  // Rule 7: Tier 1 compensation (moderate delay)
  if (delayMinutes >= config.tier1DelayMinutes) {
    return {
      status: 'ELIGIBLE',
      compensationPct: config.tier1Pct,
      legalBasis: ['EU_2021_782_art19', 'NO_jernbane_passasjerrett'],
      reasons: [
        `Forsinkelsen er ${delayMinutes} minutter.`,
        `Du har krav på ${config.tier1Pct}% erstatning av billettpris.`,
      ],
      debug: {
        ...debug,
        appliedRule: 'TIER1_MODERATE_DELAY',
      },
    };
  }

  // Rule 8: On time or early (should not reach here, but handle gracefully)
  return {
    status: 'NOT_ELIGIBLE',
    compensationPct: 0,
    legalBasis: [],
    reasons: [
      'Toget var i rute eller ankom tidlig.',
      'Ingen forsinkelse registrert.',
    ],
    debug: {
      ...debug,
      appliedRule: 'ON_TIME',
    },
  };
}

/**
 * Calculate compensation amount in NOK
 *
 * @param ticketPriceNOK - Ticket price in Norwegian kroner
 * @param compensationPct - Compensation percentage (0-100)
 * @returns Compensation amount in NOK (rounded to nearest krone)
 */
export function calculateCompensationAmount(
  ticketPriceNOK: number,
  compensationPct: number
): number {
  if (ticketPriceNOK <= 0 || compensationPct <= 0) {
    return 0;
  }

  const amount = (ticketPriceNOK * compensationPct) / 100;
  return Math.round(amount);
}

/**
 * Format compensation outcome as user-friendly text
 *
 * @param outcome - Rule outcome from evaluation
 * @param ticketPriceNOK - Ticket price for amount calculation
 * @returns Formatted summary text in Norwegian
 */
export function formatOutcomeSummary(
  outcome: RuleOutcome,
  ticketPriceNOK?: number
): string {
  if (outcome.status === 'UNKNOWN') {
    return 'Status ukjent - kan ikke evaluere krav.';
  }

  if (outcome.status === 'NOT_ELIGIBLE') {
    return `Ikke berettiget til erstatning. ${outcome.reasons.join(' ')}`;
  }

  if (outcome.status === 'ELIGIBLE') {
    const amountText = ticketPriceNOK
      ? ` (${calculateCompensationAmount(ticketPriceNOK, outcome.compensationPct)} kr)`
      : '';

    return `Berettiget til ${outcome.compensationPct}% erstatning${amountText}. ${outcome.reasons.join(' ')}`;
  }

  return 'Ukjent status.';
}
