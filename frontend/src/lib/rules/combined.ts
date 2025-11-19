/**
 * Combined Rule Evaluation (TR-RU-502)
 *
 * Combines EU base rules (TR-RU-501) with operator-specific overrides (TR-RU-502).
 * Always selects the HIGHER compensation percentage to benefit the passenger.
 */

import { RuleInput, RuleOutcome } from './types';
import { evaluateBaseCompensation } from './baseRules';
import { evaluateOperatorOverride } from './operatorRules';

/**
 * Evaluate compensation with operator rules
 *
 * This is the main evaluation function that combines:
 * 1. EU base rules (TR-RU-501)
 * 2. Operator-specific Norwegian rules (TR-RU-502)
 *
 * The function ALWAYS selects the rule that gives HIGHER compensation
 * to ensure passengers get the best possible outcome.
 *
 * @param input - Rule input with journey and delay data
 * @returns Combined rule outcome with highest compensation
 */
export function evaluateWithOperatorRules(input: RuleInput): RuleOutcome {
  // Step 1: Evaluate EU base rules (always)
  const baseOutcome = evaluateBaseCompensation(input);

  // Step 2: Check for operator-specific override
  const operatorOutcome = evaluateOperatorOverride(input);

  // Step 3: If no operator override, use base rules
  if (!operatorOutcome) {
    return {
      ...baseOutcome,
      debug: {
        ...baseOutcome.debug,
        evaluationSource: 'BASE_ONLY',
        baseCompensationPct: baseOutcome.compensationPct,
        operatorOverride: false,
      },
    };
  }

  // Step 4: Compare and select highest compensation
  if (operatorOutcome.compensationPct > baseOutcome.compensationPct) {
    // Operator rules are better - use them
    return {
      ...operatorOutcome,
      // Merge legal basis from both sources
      legalBasis: [
        ...new Set([...baseOutcome.legalBasis, ...operatorOutcome.legalBasis]),
      ],
      // Prepend operator reason, keep other context
      reasons: [
        ...operatorOutcome.reasons,
        ...baseOutcome.reasons.filter((r) =>
          // Avoid duplicating delay minutes text
          !r.includes('Forsinkelsen er')
        ),
      ],
      debug: {
        ...operatorOutcome.debug,
        evaluationSource: 'OPERATOR_OVERRIDE_SELECTED',
        baseCompensationPct: baseOutcome.compensationPct,
        operatorCompensationPct: operatorOutcome.compensationPct,
        winner: 'OPERATOR',
      },
    };
  }

  // Step 5: Base rules are equal or better - use base
  return {
    ...baseOutcome,
    debug: {
      ...baseOutcome.debug,
      evaluationSource: 'BASE_SELECTED',
      baseCompensationPct: baseOutcome.compensationPct,
      operatorCompensationPct: operatorOutcome.compensationPct,
      winner: 'BASE',
      operatorOverride: true,
      operatorOverrideRejectedReason: 'Base rules provide equal or better compensation',
    },
  };
}

/**
 * Evaluate and calculate compensation with amount (combined rules)
 *
 * Convenience function that uses combined rules and calculates NOK amount.
 *
 * @param input - Rule input with journey and delay data
 * @param ticketPriceNOK - Ticket price in Norwegian kroner
 * @returns Rule outcome with calculated amount
 */
export function evaluateWithOperatorRulesAndAmount(
  input: RuleInput,
  ticketPriceNOK: number
): RuleOutcome & { compensationAmountNOK: number } {
  const outcome = evaluateWithOperatorRules(input);

  const compensationAmountNOK =
    ticketPriceNOK > 0 && outcome.compensationPct > 0
      ? Math.round((ticketPriceNOK * outcome.compensationPct) / 100)
      : 0;

  return {
    ...outcome,
    compensationAmountNOK,
  };
}
