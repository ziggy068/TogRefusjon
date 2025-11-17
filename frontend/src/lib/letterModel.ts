/**
 * Letter Model for Claim Generation
 *
 * Strukturert datamodell for generering av kravbrev (PDF/HTML).
 * Kombinerer evidence, claim, og ticket-data til en ren struktur
 * som kan brukes av PDF-generator eller email-template.
 *
 * Skiller tydelig mellom:
 * - Fakta (tider, forsinkelse, årsak)
 * - Juridisk vurdering (regelreferanser, kompensasjon)
 * - Krav (beløp, prosent)
 */

import { JourneyEvidence } from './evidence';
import { Claim } from '@/types/journey';
import { Ticket } from './journeyInstances';

// ============================================================================
// Letter Model Types
// ============================================================================

/**
 * Header Section
 * Avsender, mottaker, dato
 */
export interface LetterHeader {
  // Passenger (sender)
  passengerName: string;
  passengerAddress?: string;
  passengerEmail?: string;
  passengerPhone?: string;

  // Operator (recipient)
  operatorName: string;
  operatorAddress?: string;
  operatorClaimsEmail?: string;

  // Date
  letterDate: string; // YYYY-MM-DD
  referenceNumber?: string; // Claim ID or custom ref
}

/**
 * Introduction Section
 * Kort innledning om reisen og kravet
 */
export interface LetterIntroduction {
  trainNumber: string;
  operator: string;
  travelDate: string; // YYYY-MM-DD
  fromStation: string;
  toStation: string;
  ticketReference?: string;
}

/**
 * Facts Section
 * Objektive fakta om forsinkelsen
 */
export interface LetterFacts {
  // Planned times
  plannedDeparture: string; // ISO 8601 or formatted
  plannedArrival: string;

  // Actual times
  actualDeparture?: string;
  actualArrival?: string;
  expectedArrival?: string;

  // Delay
  delayMinutesArrival: number;
  isCancelled: boolean;

  // Source
  dataSource: string; // "Entur Journey Planner v3"
  dataFetchedAt: string;
}

/**
 * Cause Section
 * Årsak til forsinkelse/kansellering
 */
export interface LetterCause {
  classifiedCause: string; // Human-readable
  forceMajeure: boolean;
  forceMajeureExplanation?: string; // Hvis force majeure, forklar hvorfor
}

/**
 * Legal Basis Section
 * Juridiske referanser og vurdering
 */
export interface LetterLegalBasis {
  rulesVersion: string;
  legalReferences: Array<{
    ref: string; // "EU_2021_782_art19"
    description: string; // "EU-forordning 2021/782 artikkel 19: Kompensasjon for forsinkelse"
  }>;
  applicableRule: string; // "60-119 minutter forsinkelse gir rett til 25% kompensasjon"
}

/**
 * Claim Section
 * Krav om kompensasjon
 */
export interface LetterClaim {
  ticketPriceNOK: number;
  compensationPct: number; // 25, 50, 100
  compensationAmountNOK: number;
  bankAccount?: string; // IBAN for refund
}

/**
 * Attachments Section
 * Vedlegg til kravbrevet
 */
export interface LetterAttachments {
  ticketCopy: boolean;
  idCopy: boolean;
  otherDocuments?: string[]; // Descriptions of other attachments
}

/**
 * Complete Letter Model
 * Fullstendig strukturert datamodell for kravbrev
 */
export interface ClaimLetterModel {
  header: LetterHeader;
  introduction: LetterIntroduction;
  facts: LetterFacts;
  cause: LetterCause;
  legalBasis: LetterLegalBasis;
  claim: LetterClaim;
  attachments: LetterAttachments;

  // Metadata
  generatedAt: Date;
  language: 'no' | 'en'; // For future i18n
}

// ============================================================================
// Letter Model Builder
// ============================================================================

/**
 * Build claim letter model from evidence, claim, and ticket
 *
 * Kombinerer alle data-kilder til en strukturert letter model som kan
 * brukes av PDF-generator eller email-template i M7 (TR-CL-601).
 *
 * @param evidence - Journey evidence package
 * @param claim - Claim document
 * @param ticket - Ticket document
 * @param passengerInfo - Passenger information from user profile
 * @returns Complete letter model ready for rendering
 */
export function buildClaimLetterModel(
  evidence: JourneyEvidence,
  claim: Claim,
  ticket: Ticket,
  passengerInfo: {
    fullName: string;
    email?: string;
    iban?: string;
  }
): ClaimLetterModel {
  // Header
  const header: LetterHeader = {
    passengerName: passengerInfo.fullName,
    passengerEmail: passengerInfo.email,
    operatorName: getOperatorFullName(evidence.journeyInstanceRef.operator),
    operatorClaimsEmail: getOperatorClaimsEmail(
      evidence.journeyInstanceRef.operator
    ),
    letterDate: new Date().toISOString().split('T')[0],
    referenceNumber: claim.status === 'draft' ? undefined : claim.userId, // TODO: Use proper claim ID
  };

  // Introduction
  const introduction: LetterIntroduction = {
    trainNumber: evidence.journeyInstanceRef.trainNumber,
    operator: evidence.journeyInstanceRef.operator,
    travelDate: evidence.journeyInstanceRef.serviceDate,
    fromStation: evidence.journeyInstanceRef.fromStopPlaceId, // TODO: Map to human-readable name
    toStation: evidence.journeyInstanceRef.toStopPlaceId,
    ticketReference: ticket.rawQRData ? 'QR-kode vedlagt' : 'Billett vedlagt',
  };

  // Facts
  const facts: LetterFacts = {
    plannedDeparture: evidence.timing.plannedDeparture.toISOString(),
    plannedArrival: evidence.timing.plannedArrival.toISOString(),
    actualDeparture: evidence.timing.actualDeparture?.toISOString(),
    actualArrival: evidence.timing.actualArrival?.toISOString(),
    expectedArrival: evidence.timing.expectedArrival?.toISOString(),
    delayMinutesArrival: evidence.timing.delayMinutesArrival,
    isCancelled: evidence.timing.isCancelled,
    dataSource: evidence.entur.source,
    dataFetchedAt: evidence.entur.fetchedAt.toISOString(),
  };

  // Cause
  const cause: LetterCause = {
    classifiedCause: evidence.cause.humanReadableCause || 'Ikke spesifisert',
    forceMajeure: evidence.cause.forceMajeureFlag,
    forceMajeureExplanation: evidence.cause.forceMajeureFlag
      ? 'Basert på klassifisering av årsak anses dette som ekstraordinær omstendighet i henhold til EU 2021/782 art. 19 (5).'
      : undefined,
  };

  // Legal Basis
  const legalBasis: LetterLegalBasis = {
    rulesVersion: evidence.rules.rulesSnapshotVersion,
    legalReferences: evidence.rules.legalBasisRefs.map((ref) => ({
      ref,
      description: getLegalReferenceDescription(ref),
    })),
    applicableRule: getApplicableRuleText(
      claim.calculatedCompensationPct,
      evidence.timing.delayMinutesArrival,
      evidence.cause.forceMajeureFlag
    ),
  };

  // Claim
  const claimSection: LetterClaim = {
    ticketPriceNOK: claim.ticketPriceNOK,
    compensationPct: claim.calculatedCompensationPct,
    compensationAmountNOK: claim.calculatedCompensationAmountNOK,
    bankAccount: passengerInfo.iban,
  };

  // Attachments
  const attachments: LetterAttachments = {
    ticketCopy: true,
    idCopy: true,
    otherDocuments: [],
  };

  return {
    header,
    introduction,
    facts,
    cause,
    legalBasis,
    claim: claimSection,
    attachments,
    generatedAt: new Date(),
    language: 'no',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get operator full name
 */
function getOperatorFullName(operator: string): string {
  const operatorMap: Record<string, string> = {
    Vy: 'Vy Tog AS',
    SJ: 'SJ Norge AS',
    GoAhead: 'Go-Ahead Nordic AS',
  };
  return operatorMap[operator] || operator;
}

/**
 * Get operator claims email
 */
function getOperatorClaimsEmail(operator: string): string {
  const emailMap: Record<string, string> = {
    Vy: 'kundeservice@vy.no',
    SJ: 'kundeservice@sj.no',
    GoAhead: 'kundeservice@go-aheadnordic.no',
  };
  return emailMap[operator] || 'kundeservice@example.com';
}

/**
 * Get legal reference description (human-readable)
 */
function getLegalReferenceDescription(ref: string): string {
  const descriptionMap: Record<string, string> = {
    EU_2021_782_art19:
      'EU-forordning 2021/782 artikkel 19: Kompensasjon for forsinkelse',
    EU_2021_782_art19_para5:
      'EU-forordning 2021/782 artikkel 19 (5): Unntak for ekstraordinære omstendigheter',
    NO_jernbane_forskrift_2023:
      'Forskrift om passasjerers rettigheter ved jernbanetransport (Norge)',
    Vy_passasjervilkår_2024: 'Vys passasjervilkår 2024',
    SJ_passasjervilkår_2024: 'SJs passasjervilkår 2024',
    GoAhead_passasjervilkår_2024: 'Go-Ahead Nordics passasjervilkår 2024',
  };
  return descriptionMap[ref] || ref;
}

/**
 * Get applicable rule text based on compensation percentage
 */
function getApplicableRuleText(
  compensationPct: number,
  delayMinutes: number,
  forceMajeure: boolean
): string {
  if (forceMajeure) {
    return 'Forsinkelsen skyldes ekstraordinære omstendigheter. Kompensasjon kan ikke kreves i henhold til EU 2021/782 art. 19 (5).';
  }

  if (delayMinutes < 60) {
    return 'Forsinkelsen er under 60 minutter. Ingen kompensasjon etter EU 2021/782.';
  }

  if (delayMinutes >= 60 && delayMinutes < 120) {
    return '60-119 minutter forsinkelse gir rett til 25% kompensasjon i henhold til EU 2021/782 art. 19.';
  }

  if (delayMinutes >= 120) {
    return '120 minutter eller mer forsinkelse gir rett til 50% kompensasjon i henhold til EU 2021/782 art. 19.';
  }

  return 'Kompensasjon beregnes i henhold til EU 2021/782 art. 19.';
}

// ============================================================================
// Example Letter Model (for documentation)
// ============================================================================

/**
 * Example ClaimLetterModel for Vy train 601 with 40 minutes delay
 *
 * This is a fictional example for documentation purposes.
 */
export const EXAMPLE_CLAIM_LETTER_MODEL: ClaimLetterModel = {
  header: {
    passengerName: 'Ola Nordmann',
    passengerEmail: 'ola@example.com',
    operatorName: 'Vy Tog AS',
    operatorClaimsEmail: 'kundeservice@vy.no',
    letterDate: '2025-01-20',
    referenceNumber: 'CLAIM-2025-001',
  },
  introduction: {
    trainNumber: '601',
    operator: 'Vy',
    travelDate: '2025-01-17',
    fromStation: 'Oslo S',
    toStation: 'Bergen',
    ticketReference: 'Billett vedlagt',
  },
  facts: {
    plannedDeparture: '2025-01-17T08:25:00Z',
    plannedArrival: '2025-01-17T15:34:00Z',
    actualDeparture: '2025-01-17T08:32:00Z',
    actualArrival: '2025-01-17T16:14:00Z',
    delayMinutesArrival: 40,
    isCancelled: false,
    dataSource: 'Entur Journey Planner v3',
    dataFetchedAt: '2025-01-17T16:30:00Z',
  },
  cause: {
    classifiedCause: 'Teknisk feil',
    forceMajeure: false,
  },
  legalBasis: {
    rulesVersion: 'EU2021_782_v1+NO_forskrift_v2025-02-07+Vy_v2024-10',
    legalReferences: [
      {
        ref: 'EU_2021_782_art19',
        description:
          'EU-forordning 2021/782 artikkel 19: Kompensasjon for forsinkelse',
      },
      {
        ref: 'NO_jernbane_forskrift_2023',
        description:
          'Forskrift om passasjerers rettigheter ved jernbanetransport (Norge)',
      },
    ],
    applicableRule:
      'Forsinkelsen er under 60 minutter. Ingen kompensasjon etter EU 2021/782.',
  },
  claim: {
    ticketPriceNOK: 899,
    compensationPct: 0,
    compensationAmountNOK: 0,
    bankAccount: 'NO9386011117947',
  },
  attachments: {
    ticketCopy: true,
    idCopy: true,
    otherDocuments: [],
  },
  generatedAt: new Date('2025-01-20T10:00:00Z'),
  language: 'no',
};
