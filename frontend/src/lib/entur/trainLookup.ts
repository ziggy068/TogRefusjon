/**
 * Train lookup by number and date (TR-IM-303)
 *
 * Simplified wrapper around existing enturTog.ts functionality
 */

import { enturQuery } from '../enturClient';

export interface TrainStop {
  stationName: string;
  stationId: string;
  departureTime?: string;
  arrivalTime?: string;
}

export interface TrainLookupResult {
  fromStationName: string;
  fromStationId: string;
  toStationName: string;
  toStationId: string;
  plannedDepartureTime: string;
  plannedArrivalTime?: string;
  serviceJourneyId?: string;
  lineName?: string;
  allStops: TrainStop[]; // All stops on the route
  raw?: any;
}

export interface TrainLookupParams {
  trainNumber: string;
  serviceDate: string; // YYYY-MM-DD
  operatorCode?: string;
}

// Major Norwegian train stations to search from
const MAJOR_STATIONS = [
  { id: 'NSR:StopPlace:548', name: 'Oslo S' },
  { id: 'NSR:StopPlace:337', name: 'Trondheim S' },
  { id: 'NSR:StopPlace:418', name: 'Bergen stasjon' },
  { id: 'NSR:StopPlace:595', name: 'Stavanger stasjon' },
  { id: 'NSR:StopPlace:551', name: 'Drammen stasjon' },
  { id: 'NSR:StopPlace:59', name: 'Lillehammer stasjon' },
];

// GraphQL query with date/time filtering and full journey pattern
const DEPARTURES_WITH_DATE_QUERY = `
  query GetDeparturesWithDate($stopPlaceId: String!, $startTime: DateTime!, $numberOfDepartures: Int!) {
    stopPlace(id: $stopPlaceId) {
      id
      name
      estimatedCalls(startTime: $startTime, numberOfDepartures: $numberOfDepartures, timeRange: 86400) {
        aimedDepartureTime
        aimedArrivalTime
        expectedDepartureTime
        expectedArrivalTime
        cancellation
        serviceJourney {
          id
          line {
            id
            publicCode
            name
          }
          journeyPattern {
            pointsOnLink {
              points
            }
          }
          estimatedCalls {
            quay {
              stopPlace {
                id
                name
              }
            }
            aimedDepartureTime
            aimedArrivalTime
            destinationDisplay {
              frontText
            }
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

interface EstimatedCall {
  aimedDepartureTime?: string;
  aimedArrivalTime?: string;
  expectedDepartureTime?: string;
  expectedArrivalTime?: string;
  cancellation: boolean;
  serviceJourney: {
    id: string;
    line: {
      id: string;
      publicCode: string;
      name?: string;
    };
    estimatedCalls?: Array<{
      quay?: {
        stopPlace?: {
          id: string;
          name: string;
        };
      };
      aimedDepartureTime?: string;
      aimedArrivalTime?: string;
      destinationDisplay?: {
        frontText?: string;
      };
    }>;
  };
  destinationDisplay?: {
    frontText?: string;
  };
  quay?: {
    id: string;
    name?: string;
  };
}

/**
 * Lookup train by number and date
 *
 * Searches major stations for the train on the specified date
 */
export async function lookupTrainByNumber(
  params: TrainLookupParams
): Promise<TrainLookupResult | null> {
  const { trainNumber, serviceDate } = params;

  // Convert serviceDate (YYYY-MM-DD) to ISO 8601 timestamp at start of day (00:00 UTC)
  const startTime = `${serviceDate}T00:00:00Z`;

  console.log(`[TrainLookup] Searching for train ${trainNumber} on ${serviceDate}`);

  // Search through major stations
  for (const station of MAJOR_STATIONS) {
    try {
      console.log(`[TrainLookup] Checking ${station.name}...`);

      // Query Entur for departures on the specific date
      const response = await enturQuery<{
        stopPlace: {
          id: string;
          name: string;
          estimatedCalls: EstimatedCall[];
        };
      }>(DEPARTURES_WITH_DATE_QUERY, {
        stopPlaceId: station.id,
        startTime,
        numberOfDepartures: 200, // Get more departures for a full day
      });

      if (!response.stopPlace) {
        console.warn(`[TrainLookup] Stop place not found: ${station.id}`);
        continue;
      }

      const estimatedCalls = response.stopPlace.estimatedCalls || [];

      console.log(`[TrainLookup] Got ${estimatedCalls.length} departures from ${station.name}`);

      // Debug: Log first 10 train numbers to see format
      if (estimatedCalls.length > 0) {
        const sampleCodes = estimatedCalls.slice(0, 10).map(call =>
          call.serviceJourney?.line?.publicCode || 'NO_CODE'
        );
        console.log(`[TrainLookup] Sample publicCodes from ${station.name}:`, sampleCodes.join(', '));
      }

      // Find matching train by publicCode
      const match = estimatedCalls.find(
        (call) => call.serviceJourney.line.publicCode.toUpperCase() === trainNumber.toUpperCase()
      );

      if (match) {
        console.log(`[TrainLookup] Found ${trainNumber} at ${station.name}!`);

        // Get full journey route from estimatedCalls
        const journeyCalls = match.serviceJourney.estimatedCalls || [];

        if (journeyCalls.length > 0) {
          // First stop = origin, last stop = destination
          const firstStop = journeyCalls[0];
          const lastStop = journeyCalls[journeyCalls.length - 1];

          const fromStationName = firstStop.quay?.stopPlace?.name || 'Ukjent';
          const fromStationId = firstStop.quay?.stopPlace?.id || '';
          const toStationName = lastStop.quay?.stopPlace?.name || 'Ukjent';
          const toStationId = lastStop.quay?.stopPlace?.id || '';

          // Build allStops array
          const allStops: TrainStop[] = journeyCalls.map(call => ({
            stationName: call.quay?.stopPlace?.name || 'Ukjent',
            stationId: call.quay?.stopPlace?.id || '',
            departureTime: call.aimedDepartureTime,
            arrivalTime: call.aimedArrivalTime,
          }));

          console.log(`[TrainLookup] Full route: ${fromStationName} → ${toStationName} (${journeyCalls.length} stops)`);

          return {
            fromStationName,
            fromStationId,
            toStationName,
            toStationId,
            plannedDepartureTime: firstStop.aimedDepartureTime || '',
            plannedArrivalTime: lastStop.aimedArrivalTime || '',
            serviceJourneyId: match.serviceJourney.id,
            lineName: match.serviceJourney.line.publicCode,
            allStops,
            raw: match,
          };
        } else {
          // Fallback to old behavior if no estimatedCalls
          console.warn(`[TrainLookup] No journey calls available, using fallback`);
          const destination = match.destinationDisplay?.frontText || 'Ukjent';

          return {
            fromStationName: station.name,
            fromStationId: station.id,
            toStationName: destination,
            toStationId: '',
            plannedDepartureTime: match.aimedDepartureTime || match.expectedDepartureTime || '',
            plannedArrivalTime: undefined,
            serviceJourneyId: match.serviceJourney.id,
            lineName: match.serviceJourney.line.publicCode,
            allStops: [],
            raw: match,
          };
        }
      }
    } catch (error: any) {
      console.warn(`[TrainLookup] Error at ${station.name}:`, error.message);
      // Continue to next station
    }
  }

  console.log(`[TrainLookup] No train ${trainNumber} found on ${serviceDate}`);
  return null;
}
