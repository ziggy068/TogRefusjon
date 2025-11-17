/**
 * JourneyInstance Firestore Helpers
 *
 * Implements find-or-create logic for journeyInstances:
 * - One journeyInstance per unique train journey (operator + train + date + route)
 * - Multiple claims can reference the same journeyInstance
 * - Evidence (Entur data) is stored once per journey, not per passenger
 */

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  JourneyInstance,
  CauseClassification,
  buildJourneyNaturalKey,
} from '@/types/journey';
import { getJourneyInstanceDataFromEntur } from './enturTog';
import { CURRENT_RULE_VERSION } from './ruleEngine';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Remove undefined values from object before writing to Firestore
 *
 * Firestore does not support undefined values. This helper strips them out.
 *
 * @param obj - Object that may contain undefined values
 * @returns Object with undefined values removed
 */
function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

// ============================================================================
// Ticket Type (from existing database schema)
// ============================================================================

export interface Ticket {
  userId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  trainNo: string;
  operator: string;
  from: string; // Station name (e.g., "Oslo S")
  to: string; // Station name (e.g., "Lillehammer")
  fileURL?: string;
  fileName?: string;
  fileType?: string;
  description?: string;
  source: 'qr' | 'manual' | 'email';
  rawQRData?: string;
  status: 'imported' | 'validated' | 'tracked';
  importedAt: Timestamp;
  claimStatus?: 'none' | 'eligible' | 'submitted';

  // Optional: if we have mapped NSR IDs (future enhancement)
  fromStopPlaceId?: string;
  toStopPlaceId?: string;
}

// ============================================================================
// Station Name → NSR:StopPlace ID Mapping
// ============================================================================

/**
 * TODO: Replace with proper Entur Geocoder API or database lookup
 *
 * This is a STUB mapping for MVP. In production, use:
 * - Entur Geocoder API to resolve station names
 * - Pre-built lookup table from Entur Stop Place Registry
 *
 * NOTE: These IDs are verified against Entur's Stop Place Registry
 */
const STATION_TO_NSR: Record<string, string> = {
  'Oslo S': 'NSR:StopPlace:59872', // FIXED: Was 548, correct is 59872
  'Bergen stasjon': 'NSR:StopPlace:418',
  Lillehammer: 'NSR:StopPlace:320',
  Trondheim: 'NSR:StopPlace:642',
  Stavanger: 'NSR:StopPlace:595',
  Kristiansand: 'NSR:StopPlace:259',
  Drammen: 'NSR:StopPlace:160',
  Skien: 'NSR:StopPlace:571',
  // Add more as needed
};

/**
 * Resolve station name to NSR:StopPlace ID
 *
 * @param stationName - Station name from ticket (e.g., "Oslo S")
 * @returns NSR:StopPlace ID or undefined if not found
 */
function resolveStopPlaceId(stationName: string): string | undefined {
  // Try exact match first
  if (STATION_TO_NSR[stationName]) {
    return STATION_TO_NSR[stationName];
  }

  // Try case-insensitive match
  const normalized = stationName.toLowerCase().trim();
  for (const [key, value] of Object.entries(STATION_TO_NSR)) {
    if (key.toLowerCase() === normalized) {
      return value;
    }
  }

  return undefined;
}

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Build natural key from ticket
 *
 * Uses ticket fields to construct a deterministic key for finding/creating
 * journeyInstance.
 *
 * @param ticket - Ticket document from Firestore
 * @returns Natural key string
 */
export function buildJourneyInstanceKeyFromTicket(ticket: Ticket): string {
  // Resolve station names to NSR IDs (or use provided IDs)
  const fromStopPlaceId =
    ticket.fromStopPlaceId || resolveStopPlaceId(ticket.from);
  const toStopPlaceId = ticket.toStopPlaceId || resolveStopPlaceId(ticket.to);

  if (!fromStopPlaceId || !toStopPlaceId) {
    throw new Error(
      `Cannot resolve stop place IDs for ticket: ${ticket.from} → ${ticket.to}. ` +
        `Please add mappings to STATION_TO_NSR or use Entur Geocoder API.`
    );
  }

  return buildJourneyNaturalKey(
    ticket.operator,
    ticket.trainNo,
    ticket.date,
    fromStopPlaceId,
    toStopPlaceId
  );
}

/**
 * Find existing journeyInstance by natural key
 *
 * @param key - Natural key (from buildJourneyInstanceKeyFromTicket)
 * @returns JourneyInstance + Firestore ID, or null if not found
 */
export async function findJourneyInstanceByKey(
  key: string
): Promise<{ id: string; data: JourneyInstance } | null> {
  const q = query(
    collection(db, 'journeyInstances'),
    where('naturalKey', '==', key)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    data: doc.data() as JourneyInstance,
  };
}

/**
 * Create new journeyInstance from ticket
 *
 * Fetches real-time data from Entur and creates a new journeyInstance document.
 *
 * @param ticket - Ticket document from Firestore
 * @returns Created journeyInstance ID + data
 */
export async function createJourneyInstanceFromTicket(
  ticket: Ticket
): Promise<{ id: string; data: JourneyInstance }> {
  // Resolve stop place IDs
  const fromStopPlaceId =
    ticket.fromStopPlaceId || resolveStopPlaceId(ticket.from);
  const toStopPlaceId = ticket.toStopPlaceId || resolveStopPlaceId(ticket.to);

  if (!fromStopPlaceId || !toStopPlaceId) {
    throw new Error(
      `Cannot resolve stop place IDs for ticket: ${ticket.from} → ${ticket.to}`
    );
  }

  // Fetch journey data from Entur
  const enturData = await getJourneyInstanceDataFromEntur({
    operator: ticket.operator,
    trainNumber: ticket.trainNo,
    date: ticket.date,
    time: ticket.time,
    fromStopPlaceId,
    toStopPlaceId,
    fromStationName: ticket.from,
    toStationName: ticket.to,
  });

  // Build natural key
  const naturalKey = buildJourneyNaturalKey(
    enturData.operator,
    enturData.trainNumber,
    enturData.serviceDate,
    enturData.fromStopPlaceId,
    enturData.toStopPlaceId
  );

  // Create journeyInstance document
  const journeyInstance: Omit<JourneyInstance, 'createdAt' | 'updatedAt'> = {
    // Identity
    operator: enturData.operator,
    trainNumber: enturData.trainNumber,
    serviceDate: enturData.serviceDate,
    fromStopPlaceId: enturData.fromStopPlaceId,
    toStopPlaceId: enturData.toStopPlaceId,
    naturalKey,

    // Entur references
    enturServiceJourneyId: enturData.enturServiceJourneyId,
    enturLineId: enturData.enturLineId,

    // Planned times
    plannedDepartureUTC: Timestamp.fromDate(enturData.plannedDepartureUTC),
    plannedArrivalUTC: Timestamp.fromDate(enturData.plannedArrivalUTC),

    // Actual times
    actualDepartureUTC: enturData.actualDepartureUTC
      ? Timestamp.fromDate(enturData.actualDepartureUTC)
      : undefined,
    actualArrivalUTC: enturData.actualArrivalUTC
      ? Timestamp.fromDate(enturData.actualArrivalUTC)
      : undefined,
    expectedArrivalUTC: enturData.expectedArrivalUTC
      ? Timestamp.fromDate(enturData.expectedArrivalUTC)
      : undefined,
    isCancelled: enturData.isCancelled,
    delayMinutesArrival: enturData.delayMinutesArrival,

    // Cause/deviation (placeholder - will be enhanced in M5/M6)
    rawDeviations: JSON.stringify({ note: 'To be fetched from SIRI-SX API' }),
    classifiedCause: CauseClassification.UNKNOWN,
    forceMajeureFlag: false,

    // Rules and evidence
    rulesSnapshotVersion: CURRENT_RULE_VERSION, // From rule engine
    evidenceSummary: `${enturData.trainNumber} from ${enturData.fromStopPlaceId} to ${enturData.toStopPlaceId}: ${enturData.delayMinutesArrival} min delay`,
    enturRawJourneyStoragePath: `entur/raw/${naturalKey}.json`, // TODO: Upload to Cloud Storage in M5

    // DEV/MVP: Track matching quality for debugging and future rule evaluation
    matchingQuality: enturData.matchingQuality,
  };

  // Remove undefined values before writing to Firestore
  const dataToWrite = removeUndefined({
    ...journeyInstance,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log('[JourneyInstance] Writing to Firestore (undefined values removed)');

  const docRef = await addDoc(collection(db, 'journeyInstances'), dataToWrite);

  return {
    id: docRef.id,
    data: {
      ...journeyInstance,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
  };
}

/**
 * Find or create journeyInstance for ticket (idempotent)
 *
 * This is the main entry point for associating a ticket with a journeyInstance.
 * Uses natural key to ensure idempotency: multiple calls for the same journey
 * will return the same journeyInstance.
 *
 * @param ticket - Ticket document from Firestore
 * @returns JourneyInstance ID + data
 */
export async function findOrCreateJourneyInstanceForTicket(
  ticket: Ticket
): Promise<{ id: string; data: JourneyInstance }> {
  const naturalKey = buildJourneyInstanceKeyFromTicket(ticket);

  // Try to find existing
  const existing = await findJourneyInstanceByKey(naturalKey);
  if (existing) {
    return existing;
  }

  // Create new
  return await createJourneyInstanceFromTicket(ticket);
}
