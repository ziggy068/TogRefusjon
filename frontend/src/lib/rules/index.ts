/**
 * Rule Engine Entry Point (TR-RU-501 + TR-RU-502)
 *
 * Provides a clean API for evaluating compensation claims from domain models.
 * This file maps Ticket/JourneyInstance/DelayResult → RuleInput → RuleOutcome.
 *
 * Uses combined evaluation (TR-RU-502) that selects the best compensation
 * between EU base rules and operator-specific Norwegian rules.
 */

import { Ticket } from '../tickets/types';
import { DelayResult } from '../trainStatus/types';
import { JourneyInstance } from '@/types/journey';
import { RuleInput, RuleOutcome } from './types';
import {
  evaluateBaseCompensation,
  calculateCompensationAmount,
  formatOutcomeSummary,
} from './baseRules';
import { evaluateWithOperatorRules } from './combined';

/**
 * Evaluate claim from domain models
 *
 * This is the main entry point for the rule engine. It takes domain models
 * (Ticket, JourneyInstance, DelayResult) and returns a compensation evaluation.
 *
 * @param params - Domain models and optional overrides
 * @returns Rule outcome with eligibility, percentage, and explanations
 */
export function evaluateClaimFromDomainModels(params: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
  isForceMajeure?: boolean; // Manual override (uses journey.forceMajeureFlag by default)
}): RuleOutcome {
  const { ticket, journey, delay, isForceMajeure } = params;

  // Map domain models to RuleInput
  const ruleInput: RuleInput = {
    ticket,
    journey,
    delay,

    // Use manual override if provided, otherwise use journey's force majeure flag
    isForceMajeure: isForceMajeure !== undefined ? isForceMajeure : journey.forceMajeureFlag,

    // Extract operator code (normalize to uppercase for consistency)
    operatorCode: (ticket.operator || journey.operator || '').toUpperCase(),

    // Distance band not implemented yet - could be calculated from fromStopPlaceId/toStopPlaceId
    // or extracted from ticket metadata in future
    distanceBand: undefined,

    // Line code from ticket (e.g., "F6", "R10") - helps identify long-distance trains
    lineCode: ticket.trainNumber, // Train number often indicates line (TODO: improve mapping)
  };

  // TR-RU-503: Handle cancelled journeys (100% refund regardless of force majeure)
  // Cancelled journeys should always give full refund - passenger paid for a service that was not delivered
  if (journey.isCancelled) {
    const forceMajeureUsed = ruleInput.isForceMajeure;

    return {
      status: 'ELIGIBLE',
      compensationPct: 100,
      legalBasis: [
        'EU_2021_782_cancellation',
        'NO_jernbane_passasjerrett_kansellering',
      ],
      reasons: [
        'Toget ble innstilt. Du har krav på full refusjon av billettprisen.',
        forceMajeureUsed
          ? 'Force majeure påvirker ikke retten til refusjon for en reise som ikke ble gjennomført.'
          : 'En kansellert reise gir alltid rett til full refusjon.',
      ],
      debug: {
        evaluationSource: 'CANCELLED_JOURNEY',
        isCancelled: true,
        forceMajeureFlag: forceMajeureUsed,
        compensationPct: 100,
        reason: 'Cancelled journey always gives 100% refund',
      },
    };
  }

  // Evaluate compensation using combined rules (EU base + Norwegian operator overrides)
  // This ensures we always give the BEST compensation available
  return evaluateWithOperatorRules(ruleInput);
}

/**
 * Evaluate and calculate compensation with amount
 *
 * Convenience function that evaluates claim and calculates monetary amount.
 *
 * @param params - Domain models and optional overrides
 * @returns Rule outcome with calculated amount
 */
export function evaluateClaimWithAmount(params: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
  isForceMajeure?: boolean;
}): RuleOutcome & { compensationAmountNOK: number } {
  const outcome = evaluateClaimFromDomainModels(params);

  const ticketPriceNOK = params.ticket.priceNOK || 0;
  const compensationAmountNOK = calculateCompensationAmount(
    ticketPriceNOK,
    outcome.compensationPct
  );

  return {
    ...outcome,
    compensationAmountNOK,
  };
}

/**
 * Get user-friendly summary text
 *
 * @param params - Domain models and optional overrides
 * @returns Formatted summary text in Norwegian
 */
export function getClaimSummary(params: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
  isForceMajeure?: boolean;
}): string {
  const outcome = evaluateClaimFromDomainModels(params);
  const ticketPriceNOK = params.ticket.priceNOK;

  return formatOutcomeSummary(outcome, ticketPriceNOK);
}

// Re-export types and functions for external use
export * from './types';
export * from './baseRules';
export * from './operatorSchemas';
export * from './operatorRules';
export * from './combined';
