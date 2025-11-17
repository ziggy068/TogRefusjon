/**
 * MVP Rule Engine for Compensation Calculation
 *
 * This is a SIMPLIFIED placeholder rule engine for MVP/DEV.
 * Real production logic should implement:
 * - EU Regulation 2021/782 (passenger rights for rail transport)
 * - Norwegian railway regulations (forskrift om passasjerers rettigheter)
 * - Operator-specific terms and conditions
 * - Force majeure exceptions
 * - Distance-based thresholds
 * - Ticket type considerations (refundable/non-refundable)
 *
 * Current MVP logic:
 * - 0-59 minutes delay: 0% compensation
 * - 60-119 minutes delay: 25% compensation
 * - 120+ minutes delay: 50% compensation
 *
 * TODO M6 (TR-RU-501/502/503): Replace with proper rule engine
 */

import { CauseClassification } from '@/types/journey';

// ============================================================================
// Types
// ============================================================================

export interface CompensationInput {
  delayMinutesArrival: number;
  ticketPriceNOK: number;
  operator: string;
  serviceDate: string; // YYYY-MM-DD
  classifiedCause?: CauseClassification;
  isCancelled?: boolean;
}

export interface CompensationOutput {
  pct: number; // 0, 25, 50, or 100
  amountNOK: number;
  legalBasisRefs: string[];
  ruleVersion: string;
  forceMajeure: boolean;
  reason: string; // Human-readable explanation
}

// ============================================================================
// Rule Version
// ============================================================================

/**
 * Current rule version identifier
 *
 * Format: v{major}.{minor}-{scope}
 * - v1.0-delay-only-mvp: MVP with simple delay-based rules only
 *
 * TODO: Increment when rules change (important for audit trail)
 */
export const CURRENT_RULE_VERSION = 'v1.0-delay-only-mvp';

// ============================================================================
// Main Rule Engine
// ============================================================================

/**
 * Evaluate compensation for a delayed/cancelled train journey
 *
 * MVP Implementation:
 * - Simple delay-based thresholds (0%, 25%, 50%)
 * - Basic force majeure detection
 * - Placeholder legal references
 *
 * @param input - Journey and ticket information
 * @returns Compensation decision with legal basis
 */
export function evaluateCompensation(
  input: CompensationInput
): CompensationOutput {
  const {
    delayMinutesArrival,
    ticketPriceNOK,
    operator,
    classifiedCause,
    isCancelled,
  } = input;

  // Handle missing/invalid delay (treat as no delay)
  const delay = delayMinutesArrival ?? 0;

  // Check for force majeure (simplified MVP logic)
  const forceMajeure = isForceMajeure(classifiedCause);

  // If force majeure, no compensation (EU 2021/782 Art 19(5))
  if (forceMajeure) {
    return {
      pct: 0,
      amountNOK: 0,
      legalBasisRefs: [
        'EU_2021_782_art19_para5', // Force majeure exception
        'NO_jernbane_forskrift_2023',
        `${operator}_passasjervilkår_placeholder`,
      ],
      ruleVersion: CURRENT_RULE_VERSION,
      forceMajeure: true,
      reason: 'Forsinkelsen skyldes ekstraordinære omstendigheter (force majeure)',
    };
  }

  // Cancellation: treat as 100% delay for MVP
  // TODO: Proper cancellation handling in M6
  if (isCancelled) {
    return {
      pct: 100,
      amountNOK: Math.round(ticketPriceNOK * 100) / 100,
      legalBasisRefs: [
        'EU_2021_782_art19',
        'NO_jernbane_forskrift_2023',
        `${operator}_passasjervilkår_placeholder`,
      ],
      ruleVersion: CURRENT_RULE_VERSION,
      forceMajeure: false,
      reason: 'Toget ble kansellert',
    };
  }

  // MVP delay thresholds
  let pct = 0;
  let reason = '';

  if (delay < 60) {
    pct = 0;
    reason = `Forsinkelse ${delay} min (under 60 min) gir ingen kompensasjon`;
  } else if (delay >= 60 && delay < 120) {
    pct = 25;
    reason = `Forsinkelse ${delay} min (60-119 min) gir 25% kompensasjon`;
  } else {
    // >= 120 minutes
    pct = 50;
    reason = `Forsinkelse ${delay} min (120+ min) gir 50% kompensasjon`;
  }

  const amountNOK = Math.round((ticketPriceNOK * pct) / 100 * 100) / 100;

  return {
    pct,
    amountNOK,
    legalBasisRefs: [
      'EU_2021_782_art19', // Compensation for delays
      'NO_jernbane_forskrift_2023',
      `${operator}_passasjervilkår_placeholder`,
    ],
    ruleVersion: CURRENT_RULE_VERSION,
    forceMajeure: false,
    reason,
  };
}

// ============================================================================
// Force Majeure Detection (MVP)
// ============================================================================

/**
 * Detect if delay is due to force majeure (extraordinary circumstances)
 *
 * MVP logic: Only WEATHER_EXTREME and STRIKE count as force majeure
 *
 * TODO M6: Implement proper force majeure detection based on:
 * - EU 2021/782 Art 3(12) definition
 * - Norwegian interpretations
 * - SIRI-SX deviation data analysis
 *
 * @param cause - Classified cause from Entur data
 * @returns true if force majeure applies
 */
function isForceMajeure(cause?: CauseClassification): boolean {
  if (!cause) return false;

  // MVP: Simple classification-based detection
  switch (cause) {
    case CauseClassification.WEATHER_EXTREME:
      return true; // Ekstremt vær = force majeure
    case CauseClassification.STRIKE:
      return true; // Streik = force majeure
    case CauseClassification.THIRD_PARTY:
      return false; // TODO: Needs case-by-case analysis in M6
    case CauseClassification.NORMAL_TECHNICAL:
      return false; // Normal teknisk feil = IKKE force majeure
    case CauseClassification.UNKNOWN:
      return false; // Unknown = assume NOT force majeure (passenger-friendly)
    default:
      return false;
  }
}

// ============================================================================
// Legal Basis Reference Descriptions (for display)
// ============================================================================

/**
 * Get human-readable description for legal basis reference
 *
 * @param ref - Legal basis reference code
 * @returns Human-readable description in Norwegian
 */
export function getLegalBasisDescription(ref: string): string {
  const descriptions: Record<string, string> = {
    EU_2021_782_art19:
      'EU-forordning 2021/782 artikkel 19: Rett til kompensasjon ved forsinkelse',
    EU_2021_782_art19_para5:
      'EU-forordning 2021/782 artikkel 19(5): Unntak for ekstraordinære omstendigheter',
    NO_jernbane_forskrift_2023:
      'Forskrift om passasjerers rettigheter ved jernbanetransport (Norge, 2023)',
    Vy_passasjervilkår_placeholder: 'Vys passasjervilkår (placeholder)',
    SJ_passasjervilkår_placeholder: 'SJs passasjervilkår (placeholder)',
    GoAhead_passasjervilkår_placeholder:
      'Go-Ahead Nordics passasjervilkår (placeholder)',
  };

  return descriptions[ref] || ref;
}

// ============================================================================
// Export for testing
// ============================================================================

export const _internal = {
  isForceMajeure, // Exposed for unit testing
};
