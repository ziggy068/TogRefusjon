/**
 * Rule Engine Entry Point (TR-RU-501)
 *
 * Provides a clean API for evaluating compensation claims from domain models.
 * This file maps Ticket/JourneyInstance/DelayResult → RuleInput → RuleOutcome.
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
  };

  // Evaluate compensation using base rules
  return evaluateBaseCompensation(ruleInput);
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
