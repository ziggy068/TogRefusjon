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
// Expanded list to catch more train departures
const MAJOR_STATIONS = [
  { id: 'NSR:StopPlace:548', name: 'Oslo S' },
  { id: 'NSR:StopPlace:337', name: 'Trondheim S' },
  { id: 'NSR:StopPlace:418', name: 'Bergen stasjon' },
  { id: 'NSR:StopPlace:595', name: 'Stavanger stasjon' },
  { id: 'NSR:StopPlace:551', name: 'Drammen stasjon' },
  { id: 'NSR:StopPlace:59', name: 'Lillehammer stasjon' },
  { id: 'NSR:StopPlace:552', name: 'Hamar stasjon' },
  { id: 'NSR:StopPlace:550', name: 'Eidsvoll stasjon' },
  { id: 'NSR:StopPlace:360', name: 'Kristiansand stasjon' },
  { id: 'NSR:StopPlace:109', name: 'Bodø stasjon' },
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
 * Lookup train by number and date - returns ALL departures
 *
 * Searches major stations for ALL departures of the train on the specified date
 */
export async function lookupTrainByNumber(
  params: TrainLookupParams
): Promise<TrainLookupResult[]> {
  const { trainNumber, serviceDate } = params;

  // Convert serviceDate (YYYY-MM-DD) to start of day in Europe/Oslo timezone
  // Use the date at midnight local time, not UTC
  const startTime = `${serviceDate}T00:00:00+01:00`; // CET (Norway standard time)

  console.log(`[TrainLookup] Searching for ALL departures of train ${trainNumber} on ${serviceDate}`);
  console.log(`[TrainLookup] Using startTime: ${startTime}`);

  const allDepartures: TrainLookupResult[] = [];
  const seenServiceJourneyIds = new Set<string>(); // Deduplicate by serviceJourneyId

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
        numberOfDepartures: 500, // Increased to catch all departures of a train number
      });

      if (!response.stopPlace) {
        console.warn(`[TrainLookup] Stop place not found: ${station.id}`);
        continue;
      }

      const estimatedCalls = response.stopPlace.estimatedCalls || [];

      console.log(`[TrainLookup] Got ${estimatedCalls.length} departures from ${station.name}`);

      // Find ALL matching trains by publicCode
      const matches = estimatedCalls.filter(
        (call) => call.serviceJourney.line.publicCode.toUpperCase() === trainNumber.toUpperCase()
      );

      console.log(`[TrainLookup] Found ${matches.length} departures of ${trainNumber} at ${station.name}`);

      if (matches.length > 0) {
        // Log all unique serviceJourneyIds for debugging
        const journeyIds = matches.map(m => m.serviceJourney.id);
        console.log(`[TrainLookup] ServiceJourney IDs at ${station.name}:`, journeyIds);
      }

      for (const match of matches) {
        // Skip if we've already seen this serviceJourney (avoid duplicates)
        if (seenServiceJourneyIds.has(match.serviceJourney.id)) {
          continue;
        }
        seenServiceJourneyIds.add(match.serviceJourney.id);

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

          console.log(`[TrainLookup] Departure: ${fromStationName} → ${toStationName} at ${firstStop.aimedDepartureTime} (${journeyCalls.length} stops)`);

          allDepartures.push({
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
          });
        }
      }
    } catch (error: any) {
      console.warn(`[TrainLookup] Error at ${station.name}:`, error.message);
      // Continue to next station
    }
  }

  // Sort by departure time
  allDepartures.sort((a, b) => {
    const timeA = new Date(a.plannedDepartureTime).getTime();
    const timeB = new Date(b.plannedDepartureTime).getTime();
    return timeA - timeB;
  });

  console.log(`[TrainLookup] Found ${allDepartures.length} total departures of ${trainNumber} on ${serviceDate}`);
  return allDepartures;
}
