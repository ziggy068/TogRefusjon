/**
 * Claim Letter Builder
 *
 * Builds a structured claim letter model from:
 * - Claim document (with compensation calculation)
 * - JourneyEvidence (snapshot with timing, cause, etc.)
 * - Ticket (original ticket data)
 * - User profile (name, email)
 *
 * The generated letter is ready to be:
 * - Displayed in HTML/text
 * - Exported to PDF (future M7 task)
 * - Sent to train operators
 */

import { Claim } from '@/types/journey';
import { JourneyEvidence } from './evidence';
import { Ticket } from './journeyInstances';
import { getLegalBasisDescription } from './ruleEngine';
import {
  ClaimLetterModel,
  ClaimLetterParty,
  ClaimLetterJourneyInfo,
  ClaimLetterLegalSection,
  ClaimLetterCompensation,
  ClaimLetterMetadata,
} from '@/types/claimLetter';

// ============================================================================
// User Profile Type
// ============================================================================

/**
 * User profile from Firestore users/{userId}
 *
 * NOTE: This could be moved to a separate types file in the future
 */
export interface UserProfile {
  displayName: string;
  email: string;
  photoURL?: string | null;
}

// ============================================================================
// Helper: Resolve Station Names
// ============================================================================

/**
 * Map NSR StopPlace ID to human-readable station name
 *
 * TODO: Replace with proper lookup table or Entur API call
 * For now, use a simple mapping for MVP
 */
const NSR_TO_STATION: Record<string, string> = {
  'NSR:StopPlace:59872': 'Oslo S',
  'NSR:StopPlace:418': 'Bergen stasjon',
  'NSR:StopPlace:320': 'Lillehammer',
  'NSR:StopPlace:642': 'Trondheim',
  'NSR:StopPlace:595': 'Stavanger',
  'NSR:StopPlace:259': 'Kristiansand',
  'NSR:StopPlace:160': 'Drammen',
  'NSR:StopPlace:571': 'Skien',
};

function resolveStationName(stopPlaceId: string): string {
  return NSR_TO_STATION[stopPlaceId] || stopPlaceId;
}

// ============================================================================
// Helper: Operator Information
// ============================================================================

/**
 * Get operator contact information for claim letters
 *
 * TODO: Replace with proper database or configuration
 * For now, use placeholders for MVP
 */
function getOperatorInfo(operator: string): ClaimLetterParty {
  // TODO: Add proper operator addresses, emails, etc.
  const operatorMap: Record<string, ClaimLetterParty> = {
    Vy: {
      name: 'Vy Kundeservice',
      address: 'Postboks 1162 Sentrum, 0107 Oslo',
      email: 'kundeservice@vy.no',
    },
    SJ: {
      name: 'SJ Norge Kundeservice',
      address: undefined, // TODO
      email: 'kundeservice@sj.no',
    },
    'Go-Ahead': {
      name: 'Go-Ahead Nordic Kundeservice',
      address: undefined, // TODO
      email: undefined, // TODO
    },
  };

  return (
    operatorMap[operator] || {
      name: `${operator} Kundeservice`,
      email: undefined,
      address: undefined,
    }
  );
}

// ============================================================================
// Helper: Format Date/Time
// ============================================================================

/**
 * Format date to Norwegian readable format
 * Example: "17. januar 2025"
 */
function formatDateNorwegian(date: Date): string {
  const months = [
    'januar',
    'februar',
    'mars',
    'april',
    'mai',
    'juni',
    'juli',
    'august',
    'september',
    'oktober',
    'november',
    'desember',
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}. ${month} ${year}`;
}

/**
 * Format time to HH:MM
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('no-NO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// Main Builder Function
// ============================================================================

export interface BuildClaimLetterParams {
  claim: Claim;
  evidence: JourneyEvidence;
  ticket: Ticket;
  userProfile: UserProfile;
}

/**
 * Build claim letter model from claim, evidence, ticket, and user profile
 *
 * This is the main entry point for generating claim letters.
 *
 * @param params - All required data for building the letter
 * @returns Complete claim letter model ready for rendering
 */
export function buildClaimLetterModel(
  params: BuildClaimLetterParams
): ClaimLetterModel {
  const { claim, evidence, ticket, userProfile } = params;

  // ========================================
  // 1. Parties (From/To)
  // ========================================

  const from: ClaimLetterParty = {
    name: userProfile.displayName,
    email: userProfile.email,
    // TODO M7: Add address and phone from user profile when available
  };

  const to: ClaimLetterParty = getOperatorInfo(
    evidence.journeyInstanceRef.operator
  );

  // ========================================
  // 2. Journey Information
  // ========================================

  const journey: ClaimLetterJourneyInfo = {
    operator: evidence.journeyInstanceRef.operator,
    trainNumber: evidence.journeyInstanceRef.trainNumber,
    serviceDate: evidence.journeyInstanceRef.serviceDate,

    fromStationName: resolveStationName(
      evidence.journeyInstanceRef.fromStopPlaceId
    ),
    toStationName: resolveStationName(
      evidence.journeyInstanceRef.toStopPlaceId
    ),
    fromStopPlaceId: evidence.journeyInstanceRef.fromStopPlaceId,
    toStopPlaceId: evidence.journeyInstanceRef.toStopPlaceId,

    plannedDeparture: evidence.timing.plannedDeparture,
    plannedArrival: evidence.timing.plannedArrival,
    actualDeparture: evidence.timing.actualDeparture,
    actualArrival: evidence.timing.actualArrival,
    expectedArrival: evidence.timing.expectedArrival,
    delayMinutesArrival: evidence.timing.delayMinutesArrival,
    isCancelled: evidence.timing.isCancelled,

    humanReadableCause: evidence.cause.humanReadableCause,
  };

  // ========================================
  // 3. Legal Section
  // ========================================

  const legal: ClaimLetterLegalSection = {
    legalBasisRefs: claim.legalBasisRefs,
    ruleVersionAtDecision: claim.ruleVersionAtDecision,
    forceMajeure: claim.forceMajeureAtDecision,
    legalTexts: claim.legalBasisRefs.map((ref) => getLegalBasisDescription(ref)),
  };

  // ========================================
  // 4. Compensation
  // ========================================

  const compensation: ClaimLetterCompensation = {
    ticketPriceNOK: claim.ticketPriceNOK,
    compensationPct: claim.calculatedCompensationPct,
    compensationAmountNOK: claim.calculatedCompensationAmountNOK,
  };

  // ========================================
  // 5. Metadata
  // ========================================

  const metadata: ClaimLetterMetadata = {
    claimId: claim.userId, // TODO: Use actual claim ID when available
    journeyInstanceId: claim.journeyInstanceId,
    ruleVersionAtDecision: claim.ruleVersionAtDecision,
    generatedAt: new Date(),
  };

  // ========================================
  // 6. Subject Line
  // ========================================

  const subject = `Krav om kompensasjon for forsinket togreise – ${journey.operator} tog ${journey.trainNumber}, ${formatDateNorwegian(journey.plannedDeparture)}`;

  // ========================================
  // 7. Body Paragraphs (Norwegian)
  // ========================================

  const bodyParagraphs: string[] = [];

  // Paragraph 1: Introduction
  bodyParagraphs.push(
    `Jeg fremmer herved krav om kompensasjon for forsinket togreise i henhold til gjeldende regelverk for passasjerers rettigheter ved jernbanetransport.`
  );

  // Paragraph 2: Journey facts
  const journeyDate = formatDateNorwegian(journey.plannedDeparture);
  const departureTime = formatTime(journey.plannedDeparture);
  const arrivalTime = formatTime(journey.plannedArrival);
  const actualArrivalTime = journey.actualArrival
    ? formatTime(journey.actualArrival)
    : journey.expectedArrival
    ? formatTime(journey.expectedArrival) + ' (forventet)'
    : 'ikke registrert';

  if (journey.isCancelled) {
    bodyParagraphs.push(
      `Den ${journeyDate} skulle jeg reise med ${journey.operator} tog ${journey.trainNumber} fra ${journey.fromStationName} (planlagt avgang kl. ${departureTime}) til ${journey.toStationName} (planlagt ankomst kl. ${arrivalTime}). Toget ble kansellert.`
    );
  } else {
    bodyParagraphs.push(
      `Den ${journeyDate} reiste jeg med ${journey.operator} tog ${journey.trainNumber} fra ${journey.fromStationName} (planlagt avgang kl. ${departureTime}) til ${journey.toStationName} (planlagt ankomst kl. ${arrivalTime}). Toget ankom ${journey.toStationName} kl. ${actualArrivalTime}, det vil si ${journey.delayMinutesArrival} minutter forsinket.`
    );
  }

  // Paragraph 3: Legal basis
  // NOTE: This is MVP text. Legal phrasing should be reviewed in M7.
  const legalRefsText = legal.legalTexts.join(', ');

  if (legal.forceMajeure) {
    bodyParagraphs.push(
      `Jeg er kjent med at kompensasjon kan bortfalle ved ekstraordinære omstendigheter (force majeure) i henhold til ${legalRefsText}. Imidlertid mener jeg at forsinkelsen ikke skyldes slike omstendigheter, og at jeg derfor har krav på kompensasjon.`
    );
  } else {
    bodyParagraphs.push(
      `I henhold til ${legalRefsText} har passasjerer rett til kompensasjon ved forsinkelse over 60 minutter, forutsatt at forsinkelsen ikke skyldes ekstraordinære omstendigheter.`
    );
  }

  // Paragraph 4: Compensation calculation
  bodyParagraphs.push(
    `Min billett kostet ${compensation.ticketPriceNOK} NOK. Med en forsinkelse på ${journey.delayMinutesArrival} minutter har jeg krav på ${compensation.compensationPct}% kompensasjon, det vil si ${compensation.compensationAmountNOK} NOK.`
  );

  // Paragraph 5: Closing / Request
  // TODO M7: Add bank account number / payment info when user profile is extended
  bodyParagraphs.push(
    `Jeg ber om at kompensasjonen på ${compensation.compensationAmountNOK} NOK utbetales til meg snarest. Jeg vil komme tilbake med kontonummer for utbetaling ved forespørsel.`
  );

  bodyParagraphs.push(
    `Jeg vedlegger kopi av billett og relevante kvitteringer som dokumentasjon.`
  );

  bodyParagraphs.push(`Med vennlig hilsen,\n${from.name}`);

  // ========================================
  // Return complete model
  // ========================================

  return {
    from,
    to,
    subject,
    journey,
    legal,
    compensation,
    metadata,
    bodyParagraphs,
  };
}
