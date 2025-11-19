/**
 * Operator Compensation Schemas (TR-RU-502)
 *
 * Defines operator-specific compensation rules for Norwegian railway operators.
 * These rules are MORE GENEROUS than EU minimum requirements and override base rules.
 *
 * Based on:
 * - Vy: https://www.vy.no/reisevilkar
 * - SJ Norge: https://www.sj.no/kundeservice
 * - Go-Ahead Nordic: https://www.go-aheadnordic.no/kundeservice
 */

/**
 * Supported operator codes
 */
export type OperatorCode = 'VY' | 'SJ' | 'GOAHEAD' | 'OTHER';

/**
 * Journey type classification for operator rules
 */
export type JourneyType = 'LONG_DISTANCE' | 'OTHER';

/**
 * Compensation rule for a specific journey type
 */
export interface OperatorCompRule {
  /** Minimum delay in minutes to qualify */
  minDelayMinutes: number;

  /** Compensation percentage (0-100) */
  compensationPct: number;

  /** Description of this rule (Norwegian) */
  description: string;
}

/**
 * Operator-specific compensation scheme
 */
export interface OperatorScheme {
  /** Operator display name */
  name: string;

  /** Rules for long-distance trains */
  longDistance?: OperatorCompRule;

  /** Rules for other trains (regional, local) */
  other?: OperatorCompRule;

  /** Legal basis reference */
  legalBasis: string;
}

/**
 * Known long-distance line codes
 *
 * TODO: This can be expanded with more detailed route information
 * or replaced with a distance-based calculation when we have better data.
 */
const LONG_DISTANCE_LINES = new Set([
  // Fjerntog (Vy)
  'F6', // Bergen line
  'F7', // Dovre/Nordland/Trønder
  'F1', // Sørland
  'F5', // Vestfold

  // Named routes (partial matches)
  'OSLO-BERGEN',
  'OSLO-TRONDHEIM',
  'TRONDHEIM-BODO',
  'OSLO-KRISTIANSAND',
  'OSLO-STAVANGER',
]);

/**
 * Determine if a journey is long-distance
 *
 * @param lineCode - Line code from ticket/journey
 * @param distanceBand - Distance classification if available
 * @returns true if journey qualifies as long-distance
 */
export function isLongDistanceJourney(
  lineCode?: string,
  distanceBand?: 'SHORT' | 'MEDIUM' | 'LONG'
): boolean {
  // Explicit distance band
  if (distanceBand === 'LONG') {
    return true;
  }

  // Check line code
  if (lineCode) {
    const normalizedLine = lineCode.toUpperCase().replace(/\s/g, '-');

    // Exact match
    if (LONG_DISTANCE_LINES.has(normalizedLine)) {
      return true;
    }

    // Partial match for named routes
    for (const knownLine of LONG_DISTANCE_LINES) {
      if (knownLine.includes('-') && normalizedLine.includes(knownLine)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Operator compensation schemes
 *
 * Norwegian operators (Vy, SJ Norge, Go-Ahead Nordic) offer MORE GENEROUS
 * compensation than EU minimum:
 *
 * - Long-distance trains: 50% at 60 minutes (vs EU: 25% at 60 min)
 * - Other trains: 50% at 30 minutes (vs EU: 0% at 30 min)
 *
 * Source: Operator terms & conditions + Forbrukerrådet guidance
 */
export const OPERATOR_SCHEMES: Record<OperatorCode, OperatorScheme> = {
  VY: {
    name: 'Vy',
    longDistance: {
      minDelayMinutes: 60,
      compensationPct: 50,
      description: 'Vys reisegaranti gir 50% kompensasjon ved forsinkelse over 60 minutter på fjerntog.',
    },
    other: {
      minDelayMinutes: 30,
      compensationPct: 50,
      description: 'Vys reisegaranti gir 50% kompensasjon ved forsinkelse over 30 minutter.',
    },
    legalBasis: 'VY_reisevilkar_prisavslag',
  },

  SJ: {
    name: 'SJ Norge',
    longDistance: {
      minDelayMinutes: 60,
      compensationPct: 50,
      description: 'SJ Norges reisegaranti gir 50% kompensasjon ved forsinkelse over 60 minutter på fjerntog.',
    },
    other: {
      minDelayMinutes: 30,
      compensationPct: 50,
      description: 'SJ Norges reisegaranti gir 50% kompensasjon ved forsinkelse over 30 minutter.',
    },
    legalBasis: 'SJ_reisevilkar_prisavslag',
  },

  GOAHEAD: {
    name: 'Go-Ahead Nordic',
    longDistance: {
      minDelayMinutes: 60,
      compensationPct: 50,
      description: 'Go-Ahead Nordics reisegaranti gir 50% kompensasjon ved forsinkelse over 60 minutter på fjerntog.',
    },
    other: {
      minDelayMinutes: 30,
      compensationPct: 50,
      description: 'Go-Ahead Nordics reisegaranti gir 50% kompensasjon ved forsinkelse over 30 minutter.',
    },
    legalBasis: 'GOAHEAD_reisevilkar_prisavslag',
  },

  OTHER: {
    name: 'Ukjent operatør',
    // No operator-specific rules - will fall back to EU base rules
    legalBasis: '',
  },
};

/**
 * Normalize operator code from various formats
 *
 * @param operator - Operator string from ticket/journey
 * @returns Normalized operator code
 */
export function normalizeOperatorCode(operator?: string): OperatorCode {
  if (!operator) {
    return 'OTHER';
  }

  const normalized = operator.toUpperCase().trim();

  // Vy variants
  if (normalized === 'VY' || normalized === 'NSB' || normalized.includes('VY')) {
    return 'VY';
  }

  // SJ variants
  if (normalized === 'SJ' || normalized.includes('SJ NORGE') || normalized.includes('SJ-NORGE')) {
    return 'SJ';
  }

  // Go-Ahead variants
  if (
    normalized === 'GOAHEAD' ||
    normalized === 'GO-AHEAD' ||
    normalized.includes('GO AHEAD') ||
    normalized.includes('GO-AHEAD')
  ) {
    return 'GOAHEAD';
  }

  return 'OTHER';
}
