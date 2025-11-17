/**
 * Entur Domain Helper for Train Data
 *
 * Provides domain-specific functions for querying Entur API for train journeys,
 * departures, and real-time data.
 */

import { enturQuery } from './enturClient';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Types
// ============================================================================

export interface EstimatedCall {
  aimedDepartureTime?: string; // ISO 8601 timestamp
  aimedArrivalTime?: string;
  expectedDepartureTime?: string;
  expectedArrivalTime?: string;
  actualDepartureTime?: string;
  actualArrivalTime?: string;
  cancellation: boolean;
  serviceJourney: {
    id: string;
    line: {
      id: string;
      publicCode: string; // Train number (e.g., "R20")
    };
  };
  destinationDisplay?: {
    frontText?: string;
  };
  quay?: {
    id: string;
    name?: string;
  };
}

export interface DeparturesResponse {
  stopPlaceId: string;
  stopPlaceName?: string;
  estimatedCalls: EstimatedCall[];
}

export type MatchingQuality = 'EXACT' | 'PARTIAL' | 'FALLBACK';

export interface JourneyInstanceData {
  operator: string;
  trainNumber: string;
  serviceDate: string; // YYYY-MM-DD
  fromStopPlaceId: string;
  toStopPlaceId: string;
  enturServiceJourneyId?: string;
  enturLineId?: string;
  plannedDepartureUTC: Date;
  plannedArrivalUTC: Date;
  actualDepartureUTC?: Date;
  actualArrivalUTC?: Date;
  expectedArrivalUTC?: Date;
  isCancelled: boolean;
  delayMinutesArrival: number;
  rawResponse: string; // Serialized JSON for audit/evidence
  matchingQuality: MatchingQuality; // DEV/MVP: Track how good the station match was
}

// ============================================================================
// GraphQL Queries
// ============================================================================

const DEPARTURES_QUERY = `
  query GetDepartures($stopPlaceId: String!, $numberOfDepartures: Int!) {
    stopPlace(id: $stopPlaceId) {
      id
      name
      estimatedCalls(numberOfDepartures: $numberOfDepartures) {
        aimedDepartureTime
        aimedArrivalTime
        expectedDepartureTime
        expectedArrivalTime
        actualDepartureTime
        actualArrivalTime
        cancellation
        serviceJourney {
          id
          line {
            id
            publicCode
          }
        }
        destinationDisplay {
          frontText
        }
        quay {
          id
          name
        }
      }
    }
  }
`;

const SERVICE_JOURNEY_QUERY = `
  query GetServiceJourney($id: String!) {
    serviceJourney(id: $id) {
      id
      line {
        id
        publicCode
      }
      estimatedCalls {
        aimedDepartureTime
        aimedArrivalTime
        expectedDepartureTime
        expectedArrivalTime
        actualDepartureTime
        actualArrivalTime
        cancellation
        quay {
          id
          name
          stopPlace {
            id
            name
          }
        }
        destinationDisplay {
          frontText
        }
      }
    }
  }
`;

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Get departures for a specific stop place
 *
 * @param stopPlaceId - NSR:StopPlace ID (e.g., "NSR:StopPlace:548" for Oslo S)
 * @param numberOfDepartures - Number of departures to fetch (default: 10)
 * @returns Departures data with estimated calls
 */
export async function getDeparturesForStopPlace(
  stopPlaceId: string,
  numberOfDepartures = 10
): Promise<DeparturesResponse> {
  const response = await enturQuery<{
    stopPlace: {
      id: string;
      name: string;
      estimatedCalls: EstimatedCall[];
    };
  }>(DEPARTURES_QUERY, {
    stopPlaceId,
    numberOfDepartures,
  });

  if (!response.stopPlace) {
    throw new Error(`Stop place not found: ${stopPlaceId}`);
  }

  return {
    stopPlaceId: response.stopPlace.id,
    stopPlaceName: response.stopPlace.name,
    estimatedCalls: response.stopPlace.estimatedCalls || [],
  };
}

/**
 * Get journey instance data from Entur for a specific train/date/route
 *
 * NOTE: This is a simplified implementation. In production, you may need more
 * sophisticated matching logic to find the exact service journey, especially
 * for trains with multiple departures per day.
 *
 * TODO: Refine Entur query once we know exact mapping from ticket → Entur IDs
 *
 * @param params - Search parameters
 * @returns Journey instance data ready to be saved to Firestore
 */
export async function getJourneyInstanceDataFromEntur(params: {
  operator: string;
  trainNumber: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (approximate departure time from ticket)
  fromStopPlaceId?: string; // NSR:StopPlace ID if known
  toStopPlaceId?: string;
  fromStationName?: string; // Fallback to name-based matching
  toStationName?: string;
}): Promise<JourneyInstanceData> {
  const {
    operator,
    trainNumber,
    date,
    time,
    fromStopPlaceId,
    toStopPlaceId,
    fromStationName,
    toStationName,
  } = params;

  // If we don't have stop place IDs, we need to resolve station names to IDs
  // For now, we assume stop place IDs are provided or fail gracefully
  // TODO: Implement station name → NSR:StopPlace resolver

  if (!fromStopPlaceId) {
    throw new Error(
      `fromStopPlaceId required for Entur lookup. Station name fallback not yet implemented: ${fromStationName}`
    );
  }

  // Get departures from the origin station
  // DEV/MVP: Fetch more departures to increase chance of finding matches
  const departures = await getDeparturesForStopPlace(fromStopPlaceId, 100);

  console.log(
    `[Entur] Found ${departures.estimatedCalls.length} departures from ${fromStopPlaceId}`
  );

  // Strategy 1: Exact match (train number + time window ±2 hours)
  const targetTime = parseTimeToMinutes(time);
  let matchingCalls = departures.estimatedCalls.filter((call) => {
    const isMatchingTrain =
      call.serviceJourney.line.publicCode === trainNumber;
    if (!isMatchingTrain) return false;

    const departureTime =
      call.aimedDepartureTime || call.expectedDepartureTime;
    if (!departureTime) return false;

    const departureMinutes = parseTimeToMinutes(
      new Date(departureTime).toISOString().slice(11, 16)
    );
    const timeDiff = Math.abs(departureMinutes - targetTime);
    return timeDiff <= 120; // ±2 hours
  });

  // Strategy 2: If no exact match, try same train number (any time)
  if (matchingCalls.length === 0) {
    console.warn(
      `[Entur] No exact match for train ${trainNumber} at ${time}. Trying any time...`
    );
    matchingCalls = departures.estimatedCalls.filter(
      (call) => call.serviceJourney.line.publicCode === trainNumber
    );
  }

  // Strategy 3: DEV fallback - if still no match, pick first available departure
  // This is for DEV stability only - log a warning
  if (matchingCalls.length === 0) {
    console.warn(
      `[Entur] DEV FALLBACK: No train ${trainNumber} found. Using first available departure for testing.`
    );
    if (departures.estimatedCalls.length > 0) {
      matchingCalls = [departures.estimatedCalls[0]];
      console.warn(
        `[Entur] DEV FALLBACK: Selected train ${matchingCalls[0].serviceJourney.line.publicCode} as substitute`
      );
    }
  }

  // Final check: If we truly have no data, fail
  if (matchingCalls.length === 0) {
    throw new Error(
      `No departures found at all from ${fromStopPlaceId}. Station may be invalid or Entur API unavailable.`
    );
  }

  // Sort by closest time and pick best match
  matchingCalls.sort((a, b) => {
    const aTime = a.aimedDepartureTime || a.expectedDepartureTime || '';
    const bTime = b.aimedDepartureTime || b.expectedDepartureTime || '';
    const aMinutes = parseTimeToMinutes(
      new Date(aTime).toISOString().slice(11, 16)
    );
    const bMinutes = parseTimeToMinutes(
      new Date(bTime).toISOString().slice(11, 16)
    );
    const aDiff = Math.abs(aMinutes - targetTime);
    const bDiff = Math.abs(bMinutes - targetTime);
    return aDiff - bDiff;
  });

  const call = matchingCalls[0];
  console.log(
    `[Entur] Selected journey: ${call.serviceJourney.line.publicCode} at ${call.aimedDepartureTime || call.expectedDepartureTime}`
  );

  // Now fetch the full service journey to get all stops (including destination)
  const serviceJourneyId = call.serviceJourney.id;
  const journeyResponse = await enturQuery<{
    serviceJourney: {
      id: string;
      line: { id: string; publicCode: string };
      estimatedCalls: Array<{
        aimedDepartureTime?: string;
        aimedArrivalTime?: string;
        expectedDepartureTime?: string;
        expectedArrivalTime?: string;
        actualDepartureTime?: string;
        actualArrivalTime?: string;
        cancellation: boolean;
        quay: {
          id: string;
          name?: string;
          stopPlace: {
            id: string;
            name?: string;
          };
        };
      }>;
    };
  }>(SERVICE_JOURNEY_QUERY, { id: serviceJourneyId });

  const journey = journeyResponse.serviceJourney;
  if (!journey) {
    throw new Error(`Service journey not found: ${serviceJourneyId}`);
  }

  // Find origin and destination with fallback strategies
  // Track matching quality for both origin and destination
  let originMatchType: 'exact' | 'name' | 'fallback' = 'exact';
  let destMatchType: 'exact' | 'name' | 'fallback' = 'exact';

  // Strategy 1: Exact StopPlace ID match
  let originCall = journey.estimatedCalls.find(
    (c) => c.quay.stopPlace.id === fromStopPlaceId
  );

  // Strategy 2: If no exact ID match, try name-based matching
  if (!originCall && fromStationName) {
    originMatchType = 'name';
    console.warn(
      `[Entur] No exact match for origin ${fromStopPlaceId}, trying name match: ${fromStationName}`
    );
    const normalizedFromName = fromStationName.toLowerCase().trim();
    originCall = journey.estimatedCalls.find((c) =>
      c.quay.stopPlace.name?.toLowerCase().includes(normalizedFromName)
    );
    if (originCall) {
      console.log(
        `[Entur] Found origin by name: ${originCall.quay.stopPlace.name} (${originCall.quay.stopPlace.id})`
      );
    }
  }

  // Strategy 3: DEV fallback - use first stop
  if (!originCall) {
    originMatchType = 'fallback';
    console.warn(
      `[Entur] DEV FALLBACK: Using first stop as origin for ${serviceJourneyId}`
    );
    originCall = journey.estimatedCalls[0];
  }

  // Find destination with similar fallback strategies
  let destinationCall;

  // Strategy 1: Exact StopPlace ID match
  if (toStopPlaceId) {
    destinationCall = journey.estimatedCalls.find(
      (c) => c.quay.stopPlace.id === toStopPlaceId
    );
  }

  // Strategy 2: If no exact ID match, try name-based matching
  if (!destinationCall && toStationName) {
    destMatchType = 'name';
    console.warn(
      `[Entur] No exact match for destination ${toStopPlaceId || 'N/A'}, trying name match: ${toStationName}`
    );
    const normalizedToName = toStationName.toLowerCase().trim();
    destinationCall = journey.estimatedCalls.find((c) =>
      c.quay.stopPlace.name?.toLowerCase().includes(normalizedToName)
    );
    if (destinationCall) {
      console.log(
        `[Entur] Found destination by name: ${destinationCall.quay.stopPlace.name} (${destinationCall.quay.stopPlace.id})`
      );
    }
  }

  // Strategy 3: DEV fallback - use last stop
  if (!destinationCall) {
    destMatchType = 'fallback';
    if (toStationName || toStopPlaceId) {
      console.warn(
        `[Entur] DEV FALLBACK: Using last stop as destination for ${serviceJourneyId}`
      );
    }
    destinationCall = journey.estimatedCalls[journey.estimatedCalls.length - 1];
  }

  // Final safety check: ensure we have at least SOME stops
  if (!originCall || !destinationCall || journey.estimatedCalls.length === 0) {
    throw new Error(
      `Service journey ${serviceJourneyId} has no valid stops. Cannot create journey instance.`
    );
  }

  // Ensure origin comes before destination
  const originIndex = journey.estimatedCalls.indexOf(originCall);
  const destIndex = journey.estimatedCalls.indexOf(destinationCall);
  if (originIndex >= destIndex) {
    console.warn(
      `[Entur] DEV FALLBACK: Origin and destination order is invalid. Using first and last stop.`
    );
    originCall = journey.estimatedCalls[0];
    destinationCall = journey.estimatedCalls[journey.estimatedCalls.length - 1];
  }

  // Extract times
  const plannedDepartureUTC = new Date(originCall.aimedDepartureTime!);
  const plannedArrivalUTC = new Date(destinationCall.aimedArrivalTime!);

  const actualDepartureUTC = originCall.actualDepartureTime
    ? new Date(originCall.actualDepartureTime)
    : undefined;

  const actualArrivalUTC = destinationCall.actualArrivalTime
    ? new Date(destinationCall.actualArrivalTime)
    : undefined;

  const expectedArrivalUTC = destinationCall.expectedArrivalTime
    ? new Date(destinationCall.expectedArrivalTime)
    : undefined;

  const isCancelled = destinationCall.cancellation || false;

  // Calculate delay (use actual if available, otherwise expected)
  const effectiveArrival = actualArrivalUTC || expectedArrivalUTC;
  const delayMinutesArrival = effectiveArrival
    ? Math.round(
        (effectiveArrival.getTime() - plannedArrivalUTC.getTime()) / 1000 / 60
      )
    : 0;

  // Determine overall matching quality
  // EXACT: Both origin and destination matched exactly by ID
  // PARTIAL: At least one matched by name, none by fallback
  // FALLBACK: At least one used fallback (first/last stop)
  let matchingQuality: MatchingQuality;
  if (originMatchType === 'exact' && destMatchType === 'exact') {
    matchingQuality = 'EXACT';
  } else if (originMatchType === 'fallback' || destMatchType === 'fallback') {
    matchingQuality = 'FALLBACK';
  } else {
    matchingQuality = 'PARTIAL';
  }

  console.log(
    `[Entur] Matching quality: ${matchingQuality} (origin: ${originMatchType}, dest: ${destMatchType})`
  );

  // Construct result
  return {
    operator,
    trainNumber,
    serviceDate: date,
    fromStopPlaceId: originCall.quay.stopPlace.id,
    toStopPlaceId: destinationCall.quay.stopPlace.id,
    enturServiceJourneyId: journey.id,
    enturLineId: journey.line.id,
    plannedDepartureUTC,
    plannedArrivalUTC,
    actualDepartureUTC,
    actualArrivalUTC,
    expectedArrivalUTC,
    isCancelled,
    delayMinutesArrival,
    rawResponse: JSON.stringify(journeyResponse, null, 2),
    matchingQuality,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
