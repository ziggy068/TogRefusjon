/**
 * Operator Override Rules (TR-RU-502)
 *
 * Evaluates operator-specific compensation rules that may be MORE GENEROUS
 * than EU minimum requirements.
 */

import { RuleInput, RuleOutcome } from './types';
import {
  normalizeOperatorCode,
  isLongDistanceJourney,
  OPERATOR_SCHEMES,
  OperatorCode,
} from './operatorSchemas';

/**
 * Evaluate operator-specific compensation override
 *
 * This function checks if the operator (Vy, SJ, Go-Ahead) offers better
 * compensation than EU minimum. Returns null if no override applies.
 *
 * @param input - Rule input with journey and delay data
 * @returns Operator-specific outcome, or null if no override
 */
export function evaluateOperatorOverride(input: RuleInput): RuleOutcome | null {
  const { ticket, journey, delay, operatorCode, distanceBand, lineCode } = input;

  // Step 1: Normalize operator code
  const normalizedOp = normalizeOperatorCode(operatorCode || ticket.operator);

  // Step 2: Check if this is a known operator with special rules
  if (normalizedOp === 'OTHER') {
    return null; // No operator-specific rules
  }

  // Step 3: Check delay status
  if (delay.status === 'UNKNOWN') {
    return null; // Cannot override if we don't know the delay
  }

  if (delay.status === 'CANCELLED') {
    // For cancelled journeys, operator rules typically mirror EU rules
    // So we return null and let base rules handle it
    return null;
  }

  // Step 4: Determine delay minutes
  const delayMinutes =
    delay.arrivalDelayMinutes !== undefined
      ? delay.arrivalDelayMinutes
      : delay.departureDelayMinutes !== undefined
        ? delay.departureDelayMinutes
        : 0;

  // Step 5: Determine if this is a long-distance journey
  const isLongDistance = isLongDistanceJourney(lineCode, distanceBand);

  // Step 6: Get operator scheme
  const scheme = OPERATOR_SCHEMES[normalizedOp];
  if (!scheme) {
    return null;
  }

  // Step 7: Select applicable rule
  const rule = isLongDistance ? scheme.longDistance : scheme.other;

  if (!rule) {
    return null; // No applicable rule for this journey type
  }

  // Step 8: Check if delay meets minimum threshold
  if (delayMinutes < rule.minDelayMinutes) {
    return null; // Delay too short for operator compensation
  }

  // Step 9: Return operator-specific outcome
  return {
    status: 'ELIGIBLE',
    compensationPct: rule.compensationPct,
    legalBasis: [
      'EU_2021_782_art19', // Still based on EU regulation framework
      scheme.legalBasis, // Operator-specific terms
    ],
    reasons: [
      rule.description,
      `Forsinkelsen er ${delayMinutes} minutter.`,
    ],
    debug: {
      source: 'OPERATOR_OVERRIDE',
      operatorCode: normalizedOp,
      operatorName: scheme.name,
      journeyType: isLongDistance ? 'LONG_DISTANCE' : 'OTHER',
      delayMinutes,
      lineCode,
      distanceBand,
      appliedRule: rule,
    },
  };
}
