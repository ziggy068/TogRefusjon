/**
 * Claims Firestore Helpers
 *
 * Implements claim creation logic:
 * - Fetch ticket from Firestore
 * - Find or create journeyInstance
 * - Apply simple compensation rules (placeholder)
 * - Create claim document
 */

import {
  doc,
  getDoc,
  addDoc,
  collection,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Claim, ClaimStatus } from '@/types/journey';
import {
  findOrCreateJourneyInstanceForTicket,
  Ticket,
} from './journeyInstances';
import { buildJourneyEvidence } from './evidence';
import { evaluateCompensation } from './ruleEngine';

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
// Public Functions
// ============================================================================

/**
 * Create claim for ticket
 *
 * Main workflow:
 * 1. Fetch ticket from Firestore
 * 2. Find or create journeyInstance (idempotent)
 * 3. Build evidence snapshot (for juridical traceability)
 * 4. Apply simple compensation rules
 * 5. Create claim document in Firestore with evidence snapshot
 *
 * @param userId - User ID (Firebase Auth UID)
 * @param ticketId - Ticket document ID
 * @returns Created claim ID
 */
export async function createClaimForTicket(
  userId: string,
  ticketId: string
): Promise<string> {
  // 1. Fetch ticket from Firestore
  const ticketRef = doc(db, 'users', userId, 'tickets', ticketId);
  const ticketSnap = await getDoc(ticketRef);

  if (!ticketSnap.exists()) {
    throw new Error(`Ticket not found: ${ticketId} for user ${userId}`);
  }

  const ticket = { ...ticketSnap.data(), id: ticketId } as Ticket & {
    id: string;
  };

  // 2. Find or create journeyInstance
  const journeyInstance = await findOrCreateJourneyInstanceForTicket(ticket);

  // 3. Build evidence snapshot (for juridical traceability)
  const evidence = buildJourneyEvidence(
    journeyInstance.data,
    journeyInstance.id
  );

  // 4. Get ticket price (with fallback for MVP)
  // TODO M4: Extract actual price from ticket parser/QR code
  const ticketPriceNOK = 500; // DEV/MVP: Hardcoded fallback
  console.log(
    `[Claim] Using ticket price: ${ticketPriceNOK} NOK (TODO: parse from ticket)`
  );

  // 5. Evaluate compensation using rule engine
  const compensationResult = evaluateCompensation({
    delayMinutesArrival: journeyInstance.data.delayMinutesArrival,
    ticketPriceNOK,
    operator: journeyInstance.data.operator,
    serviceDate: journeyInstance.data.serviceDate,
    classifiedCause: journeyInstance.data.classifiedCause,
    isCancelled: journeyInstance.data.isCancelled,
  });

  console.log(
    `[Claim] Compensation evaluated: ${compensationResult.pct}% (${compensationResult.amountNOK} NOK) - ${compensationResult.reason}`
  );

  // 6. Create claim document
  const claim: Omit<Claim, 'createdAt' | 'updatedAt'> = {
    // References
    userId,
    ticketId,
    journeyInstanceId: journeyInstance.id,

    // Economy (from rule engine)
    ticketPriceNOK,
    calculatedCompensationPct: compensationResult.pct,
    calculatedCompensationAmountNOK: compensationResult.amountNOK,

    // Legal (from rule engine)
    legalBasisRefs: compensationResult.legalBasisRefs,
    forceMajeureAtDecision: compensationResult.forceMajeure,
    ruleVersionAtDecision: compensationResult.ruleVersion,

    // Documents (to be generated in M7)
    generatedLetterStoragePath: undefined,
    attachmentPaths: [],

    // Evidence snapshot (immutable copy at time of claim creation)
    journeyEvidenceSnapshot: JSON.parse(JSON.stringify(evidence)),

    // Status
    status: ClaimStatus.DRAFT,
    statusHistory: [
      {
        status: ClaimStatus.DRAFT,
        timestamp: Timestamp.now(),
        note: `Claim created with rule engine ${compensationResult.ruleVersion}: ${compensationResult.reason}`,
      },
    ],

    // Metadata (will be set by serverTimestamp)
    submittedAt: undefined,
    decidedAt: undefined,
  };

  // Remove undefined values before writing to Firestore
  const dataToWrite = removeUndefined({
    ...claim,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log('[Claim] Writing to Firestore (undefined values removed)');

  // Add to Firestore (top-level collection as per TR-JR-301)
  const claimRef = await addDoc(collection(db, 'claims'), dataToWrite);

  return claimRef.id;
}
