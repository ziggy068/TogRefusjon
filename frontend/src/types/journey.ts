import { Timestamp } from 'firebase/firestore';

// === Enums ===
export enum CauseClassification {
  NORMAL_TECHNICAL = 'NORMAL_TECHNICAL',
  WEATHER_EXTREME = 'WEATHER_EXTREME',
  THIRD_PARTY = 'THIRD_PARTY',
  STRIKE = 'STRIKE',
  UNKNOWN = 'UNKNOWN',
}

export enum ClaimStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  ESCALATED = 'escalated',
}

// === JourneyInstance ===
export interface JourneyInstance {
  // Identity (natural key components)
  operator: string;
  trainNumber: string;
  serviceDate: string; // YYYY-MM-DD
  fromStopPlaceId: string;
  toStopPlaceId: string;

  // Entur references
  enturServiceJourneyId?: string;
  enturLineId?: string;

  // Planned times (UTC)
  plannedDepartureUTC: Timestamp;
  plannedArrivalUTC: Timestamp;

  // Actual times (UTC)
  actualDepartureUTC?: Timestamp;
  actualArrivalUTC?: Timestamp;
  expectedArrivalUTC?: Timestamp;
  isCancelled: boolean;
  delayMinutesArrival: number;

  // Cause/deviation
  rawDeviations: string; // JSON string
  classifiedCause: CauseClassification;
  forceMajeureFlag: boolean;

  // Rules and evidence
  rulesSnapshotVersion: string;
  evidenceSummary: string;
  enturRawJourneyStoragePath: string; // Cloud Storage path

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lockedAt?: Timestamp;

  // Natural key for find-or-create
  naturalKey: string; // "{operator}:{trainNumber}:{serviceDate}:{fromStopPlaceId}:{toStopPlaceId}"

  // DEV/MVP: Track origin/destination matching quality
  // EXACT: Both matched by NSR StopPlace ID
  // PARTIAL: At least one matched by name
  // FALLBACK: Used first/last stop as fallback
  matchingQuality?: 'EXACT' | 'PARTIAL' | 'FALLBACK';
}

// === StatusHistoryEntry ===
export interface StatusHistoryEntry {
  status: ClaimStatus;
  timestamp: Timestamp;
  note: string;
}

// === Claim ===
export interface Claim {
  // References
  userId: string;
  ticketId: string;
  journeyInstanceId: string;

  // Economy
  ticketPriceNOK: number;
  calculatedCompensationPct: number; // 25, 50, 100
  calculatedCompensationAmountNOK: number;

  // Legal
  legalBasisRefs: string[];
  forceMajeureAtDecision: boolean;
  ruleVersionAtDecision: string;

  // Documents
  generatedLetterStoragePath?: string;
  attachmentPaths: string[];

  // Evidence (snapshot at time of claim decision)
  journeyEvidenceSnapshot?: Record<string, unknown>; // JourneyEvidence serialized as JSON

  // Status
  status: ClaimStatus;
  statusHistory: StatusHistoryEntry[];

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  submittedAt?: Timestamp;
  decidedAt?: Timestamp;
}

// === Helper functions ===

/**
 * Constructs natural key for journeyInstance find-or-create logic
 */
export function buildJourneyNaturalKey(
  operator: string,
  trainNumber: string,
  serviceDate: string,
  fromStopPlaceId: string,
  toStopPlaceId: string
): string {
  return `${operator}:${trainNumber}:${serviceDate}:${fromStopPlaceId}:${toStopPlaceId}`;
}

/**
 * Parses natural key back to components (for debugging/validation)
 */
export function parseJourneyNaturalKey(naturalKey: string): {
  operator: string;
  trainNumber: string;
  serviceDate: string;
  fromStopPlaceId: string;
  toStopPlaceId: string;
} {
  const [operator, trainNumber, serviceDate, fromStopPlaceId, toStopPlaceId] =
    naturalKey.split(':');
  return { operator, trainNumber, serviceDate, fromStopPlaceId, toStopPlaceId };
}
