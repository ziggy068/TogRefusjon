/**
 * Evidence (Bevispakke) for JourneyInstance
 *
 * Juridisk etterprøvbar dokumentasjon av:
 * - Fakta (tider, forsinkelse, årsak)
 * - Juridisk vurdering (regelversjoner, legal basis)
 * - Kilde (Entur, SIRI-SX, etc.)
 *
 * En bevispakke bygges én gang per tog-reise og gjenbrukes av alle claims
 * for den reisen. Ved krav-generering snapshots bevispakken inn i claim-dokumentet
 * for å bevare tilstanden på beslutningstidspunktet.
 */

import { Timestamp } from 'firebase/firestore';
import { JourneyInstance, CauseClassification } from '@/types/journey';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { evaluateCompensation, CURRENT_RULE_VERSION } from './ruleEngine';

// ============================================================================
// Evidence Types
// ============================================================================

/**
 * Journey Instance Reference
 * Identifiserer unikt tog-reisen som beviset gjelder
 */
export interface JourneyInstanceRef {
  id: string; // Firestore document ID
  operator: string; // "Vy", "SJ", etc.
  trainNumber: string; // "601"
  serviceDate: string; // YYYY-MM-DD
  fromStopPlaceId: string; // NSR:StopPlace:548
  toStopPlaceId: string; // NSR:StopPlace:418
  naturalKey: string; // Full natural key for verification
}

/**
 * Timing Information
 * Planlagte vs. faktiske tider + forsinkelse
 */
export interface TimingEvidence {
  plannedDeparture: Date;
  plannedArrival: Date;
  actualDeparture?: Date;
  actualArrival?: Date;
  expectedArrival?: Date; // Hvis actual ikke finnes enda
  delayMinutesArrival: number;
  isCancelled: boolean;
}

/**
 * Cause Information
 * Årsak til forsinkelse/kansellering
 */
export interface CauseEvidence {
  rawDeviations: string; // JSON fra SIRI-SX/Entur deviations API
  classifiedCause: CauseClassification;
  forceMajeureFlag: boolean; // Ekstraordinær omstendighet?
  humanReadableCause?: string; // "Signalfeil ved Finse"
}

/**
 * Entur Source Information
 * Metadata om hvor dataen kommer fra
 */
export interface EnturSourceInfo {
  source: string; // "Entur Journey Planner v3 / SIRI-ET / SIRI-SX"
  fetchedAt: Date;
  serviceJourneyId?: string; // Entur's internal ID
  lineId?: string;
  rawResponseStoragePath?: string; // Cloud Storage path til rå respons
}

/**
 * Rules Information
 * Regelversjoner og juridiske referanser
 */
export interface RulesEvidence {
  rulesSnapshotVersion: string; // "EU2021_782_v1+NO_forskrift_v2025-02-07+Vy_v2024-10"
  legalBasisRefs: string[]; // ["EU_2021_782_art19", "NO_jernbane_forskrift_§1"]
}

/**
 * Complete Journey Evidence Package
 * Fullstendig bevispakke for en tog-reise
 */
export interface JourneyEvidence {
  // Reference
  journeyInstanceRef: JourneyInstanceRef;

  // Fakta
  timing: TimingEvidence;
  cause: CauseEvidence;

  // Kilde
  entur: EnturSourceInfo;

  // Juridikk
  rules: RulesEvidence;

  // Oppsummering (menneskelesbar)
  summary: string;

  // Metadata
  generatedAt: Date;
}

// ============================================================================
// Evidence Builder
// ============================================================================

/**
 * Build journey evidence package from JourneyInstance
 *
 * Konverterer en JourneyInstance (Firestore-dokument) til en strukturert
 * bevispakke som kan brukes i kravbrev og juridisk dokumentasjon.
 *
 * @param journeyInstance - JourneyInstance fra Firestore
 * @param journeyInstanceId - Firestore document ID
 * @returns Complete evidence package
 */
export function buildJourneyEvidence(
  journeyInstance: JourneyInstance,
  journeyInstanceId: string
): JourneyEvidence {
  // Journey reference
  const journeyInstanceRef: JourneyInstanceRef = {
    id: journeyInstanceId,
    operator: journeyInstance.operator,
    trainNumber: journeyInstance.trainNumber,
    serviceDate: journeyInstance.serviceDate,
    fromStopPlaceId: journeyInstance.fromStopPlaceId,
    toStopPlaceId: journeyInstance.toStopPlaceId,
    naturalKey: journeyInstance.naturalKey,
  };

  // Timing evidence
  const timing: TimingEvidence = {
    plannedDeparture: journeyInstance.plannedDepartureUTC.toDate(),
    plannedArrival: journeyInstance.plannedArrivalUTC.toDate(),
    actualDeparture: journeyInstance.actualDepartureUTC?.toDate(),
    actualArrival: journeyInstance.actualArrivalUTC?.toDate(),
    expectedArrival: journeyInstance.expectedArrivalUTC?.toDate(),
    delayMinutesArrival: journeyInstance.delayMinutesArrival,
    isCancelled: journeyInstance.isCancelled,
  };

  // Cause evidence
  const cause: CauseEvidence = {
    rawDeviations: journeyInstance.rawDeviations,
    classifiedCause: journeyInstance.classifiedCause,
    forceMajeureFlag: journeyInstance.forceMajeureFlag,
    humanReadableCause: generateHumanReadableCause(
      journeyInstance.classifiedCause,
      journeyInstance.rawDeviations
    ),
  };

  // Entur source info
  const entur: EnturSourceInfo = {
    source: 'Entur Journey Planner v3 / SIRI-ET',
    fetchedAt: journeyInstance.createdAt.toDate(),
    serviceJourneyId: journeyInstance.enturServiceJourneyId,
    lineId: journeyInstance.enturLineId,
    rawResponseStoragePath: journeyInstance.enturRawJourneyStoragePath,
  };

  // Rules evidence (use rule engine for consistent legal basis)
  // DEV/MVP: Use placeholder ticket price for rule evaluation
  const ruleEvaluation = evaluateCompensation({
    delayMinutesArrival: journeyInstance.delayMinutesArrival,
    ticketPriceNOK: 500, // Placeholder - not used for legal refs generation
    operator: journeyInstance.operator,
    serviceDate: journeyInstance.serviceDate,
    classifiedCause: journeyInstance.classifiedCause,
    isCancelled: journeyInstance.isCancelled,
  });

  const rules: RulesEvidence = {
    rulesSnapshotVersion: CURRENT_RULE_VERSION,
    legalBasisRefs: ruleEvaluation.legalBasisRefs,
  };

  // Generate summary
  const summary = generateEvidenceSummary(
    journeyInstance,
    timing,
    cause,
    rules
  );

  return {
    journeyInstanceRef,
    timing,
    cause,
    entur,
    rules,
    summary,
    generatedAt: new Date(),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate human-readable cause description
 */
function generateHumanReadableCause(
  classified: CauseClassification,
  rawDeviations: string
): string {
  // TODO: Parse rawDeviations JSON to extract detailed cause
  // For now, return classification as readable text

  const causeMap: Record<CauseClassification, string> = {
    [CauseClassification.NORMAL_TECHNICAL]: 'Teknisk feil',
    [CauseClassification.WEATHER_EXTREME]: 'Ekstremt vær',
    [CauseClassification.THIRD_PARTY]: 'Tredjeparts årsak',
    [CauseClassification.STRIKE]: 'Streik',
    [CauseClassification.UNKNOWN]: 'Ukjent årsak',
  };

  return causeMap[classified] || 'Ikke klassifisert';
}

/**
 * Generate legal basis references based on operator and delay
 *
 * This is a PLACEHOLDER. Full legal rules will be implemented in M6 (TR-RU-501).
 *
 * @param operator - Train operator
 * @param delayMinutes - Delay in minutes
 * @param forceMajeure - Force majeure flag
 * @returns Array of legal basis references
 */
function generateLegalBasisRefs(
  operator: string,
  delayMinutes: number,
  forceMajeure: boolean
): string[] {
  const refs: string[] = [];

  // EU Regulation 2021/782 (passenger rights)
  if (delayMinutes >= 60) {
    refs.push('EU_2021_782_art19'); // Compensation for delays
  }

  // Norwegian railway regulation
  refs.push('NO_jernbane_forskrift_2023');

  // Operator-specific terms
  refs.push(`${operator}_passasjervilkår_2024`);

  // Force majeure exception
  if (forceMajeure) {
    refs.push('EU_2021_782_art19_para5'); // Force majeure exception
  }

  return refs;
}

/**
 * Generate evidence summary (human-readable)
 */
function generateEvidenceSummary(
  journey: JourneyInstance,
  timing: TimingEvidence,
  cause: CauseEvidence,
  rules: RulesEvidence
): string {
  const date = journey.serviceDate;
  const train = `${journey.operator} tog ${journey.trainNumber}`;
  const route = `${journey.fromStopPlaceId} til ${journey.toStopPlaceId}`;
  const delay = timing.delayMinutesArrival;
  const causeText = cause.humanReadableCause || cause.classifiedCause;
  const forceMajeureText = cause.forceMajeureFlag
    ? ' (ekstraordinær omstendighet)'
    : ' (ikke ekstraordinær omstendighet)';

  if (timing.isCancelled) {
    return `På ${date} ble ${train} mellom ${route} kansellert. Årsak klassifisert som ${causeText}${forceMajeureText}.`;
  }

  return `På ${date} var ${train} mellom ${route} forsinket ${delay} minutter ved ankomst. Årsak klassifisert som ${causeText}${forceMajeureText}.`;
}

// ============================================================================
// Claim Integration
// ============================================================================

/**
 * Attach evidence snapshot to claim
 *
 * Henter journeyInstance for et claim og bygger en bevispakke som snapshots
 * inn i claim-dokumentet. Dette sikrer at claim har en uforanderlig kopi
 * av bevisene slik de så ut på beslutningstidspunktet.
 *
 * @param claimId - Claim document ID
 * @returns The evidence package that was attached
 */
export async function attachEvidenceToClaim(
  claimId: string
): Promise<JourneyEvidence> {
  // Fetch claim
  const claimRef = doc(db, 'claims', claimId);
  const claimSnap = await getDoc(claimRef);

  if (!claimSnap.exists()) {
    throw new Error(`Claim not found: ${claimId}`);
  }

  const claim = claimSnap.data();
  const journeyInstanceId = claim.journeyInstanceId;

  if (!journeyInstanceId) {
    throw new Error(`Claim ${claimId} has no journeyInstanceId`);
  }

  // Fetch journeyInstance
  const journeyRef = doc(db, 'journeyInstances', journeyInstanceId);
  const journeySnap = await getDoc(journeyRef);

  if (!journeySnap.exists()) {
    throw new Error(`JourneyInstance not found: ${journeyInstanceId}`);
  }

  const journeyInstance = journeySnap.data() as JourneyInstance;

  // Build evidence package
  const evidence = buildJourneyEvidence(journeyInstance, journeyInstanceId);

  // Update claim with evidence snapshot
  await updateDoc(claimRef, {
    journeyEvidenceSnapshot: JSON.parse(JSON.stringify(evidence)), // Deep copy for Firestore
    updatedAt: Timestamp.now(),
  });

  return evidence;
}

// ============================================================================
// Example Evidence Package (for documentation)
// ============================================================================

/**
 * Example JourneyEvidence for Vy train 601 (Oslo S → Bergen)
 * with 40 minutes delay due to technical issue at Finse.
 *
 * This is a fictional example for documentation purposes.
 */
export const EXAMPLE_JOURNEY_EVIDENCE: JourneyEvidence = {
  journeyInstanceRef: {
    id: 'journeyInst_abc123',
    operator: 'Vy',
    trainNumber: '601',
    serviceDate: '2025-01-17',
    fromStopPlaceId: 'NSR:StopPlace:548',
    toStopPlaceId: 'NSR:StopPlace:418',
    naturalKey: 'Vy:601:2025-01-17:NSR:StopPlace:548:NSR:StopPlace:418',
  },
  timing: {
    plannedDeparture: new Date('2025-01-17T08:25:00Z'),
    plannedArrival: new Date('2025-01-17T15:34:00Z'),
    actualDeparture: new Date('2025-01-17T08:32:00Z'),
    actualArrival: new Date('2025-01-17T16:14:00Z'),
    delayMinutesArrival: 40,
    isCancelled: false,
  },
  cause: {
    rawDeviations: JSON.stringify({
      situationNumber: 'VY-2025-0117-001',
      summary: 'Signalfeil ved Finse',
      description: 'Teknisk feil i signalanlegget forårsaket forsinkelse',
    }),
    classifiedCause: CauseClassification.NORMAL_TECHNICAL,
    forceMajeureFlag: false,
    humanReadableCause: 'Teknisk feil',
  },
  entur: {
    source: 'Entur Journey Planner v3 / SIRI-ET',
    fetchedAt: new Date('2025-01-17T16:30:00Z'),
    serviceJourneyId: 'VYG:ServiceJourney:601-20250117',
    lineId: 'VYG:Line:601',
    rawResponseStoragePath: 'gs://bucket/entur/raw/Vy_601_2025-01-17.json',
  },
  rules: {
    rulesSnapshotVersion: 'EU2021_782_v1+NO_forskrift_v2025-02-07+Vy_v2024-10',
    legalBasisRefs: [
      'EU_2021_782_art19',
      'NO_jernbane_forskrift_2023',
      'Vy_passasjervilkår_2024',
    ],
  },
  summary:
    'På 2025-01-17 var Vy tog 601 mellom NSR:StopPlace:548 til NSR:StopPlace:418 forsinket 40 minutter ved ankomst. Årsak klassifisert som Teknisk feil (ikke ekstraordinær omstendighet).',
  generatedAt: new Date('2025-01-17T17:00:00Z'),
};
