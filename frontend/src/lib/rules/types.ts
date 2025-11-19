/**
 * Rule Engine Types (TR-RU-501)
 *
 * Types for the compensation rule engine that evaluates delay claims
 * based on EU/EEA and Norwegian railway passenger rights regulations.
 */

import { Ticket } from '../tickets/types';
import { DelayResult } from '../trainStatus/types';
import { JourneyInstance } from '@/types/journey';

/**
 * Distance bands for journey classification
 * Used to determine compensation thresholds (future enhancement)
 */
export type DistanceBand = 'SHORT' | 'MEDIUM' | 'LONG';

/**
 * Input to the rule engine
 *
 * Consolidates all data needed to evaluate a compensation claim:
 * - Ticket information (price, operator, route)
 * - Journey instance (planned vs actual times, force majeure)
 * - Delay result (calculated delays, status)
 */
export interface RuleInput {
  /** Ticket information */
  ticket: Ticket;

  /** Journey instance with actual/planned times */
  journey: JourneyInstance;

  /** Delay calculation result from TR-TS-401/402 */
  delay: DelayResult;

  /** Force majeure flag (from journey or manual override) */
  isForceMajeure?: boolean;

  /** Operator code for operator-specific rules (TR-RU-502) */
  operatorCode?: string;

  /** Distance band classification (future enhancement) */
  distanceBand?: DistanceBand;

  /** Line code for identifying specific routes (TR-RU-502) */
  lineCode?: string; // e.g., "F6", "F7", "R10", "Oslo-Bergen"
}

/**
 * Eligibility status for compensation
 */
export type EligibilityStatus = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'UNKNOWN';

/**
 * Output from the rule engine
 *
 * Provides a complete evaluation result that can be used to:
 * - Determine if claim should be created
 * - Calculate compensation amount
 * - Generate user-facing explanations
 * - Provide legal basis for claims/letters
 */
export interface RuleOutcome {
  /** Eligibility status */
  status: EligibilityStatus;

  /** Compensation percentage (0-100) */
  compensationPct: number;

  /** Legal basis references (e.g., EU regulations, Norwegian laws) */
  legalBasis: string[];

  /** User-facing reasons in Norwegian */
  reasons: string[];

  /** Debug information for logging/testing */
  debug?: {
    delayMinutes?: number;
    forceMajeure?: boolean;
    operatorCode?: string;
    appliedRule?: string;
    [key: string]: any;
  };
}

/**
 * Compensation thresholds configuration
 *
 * Defines the delay thresholds and compensation percentages.
 * Based on simplified EU/Norwegian railway passenger rights.
 */
export interface CompensationConfig {
  /** Minimum delay in minutes for any compensation */
  minDelayMinutes: number;

  /** Delay threshold for first compensation tier (e.g., 25%) */
  tier1DelayMinutes: number;

  /** Compensation percentage for tier 1 */
  tier1Pct: number;

  /** Delay threshold for second compensation tier (e.g., 50%) */
  tier2DelayMinutes: number;

  /** Compensation percentage for tier 2 */
  tier2Pct: number;
}
