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
// Comprehensive list to capture trains in both directions
const MAJOR_STATIONS = [
  // Major terminals (endpoints of lines)
  { id: 'NSR:StopPlace:548', name: 'Oslo S' },
  { id: 'NSR:StopPlace:337', name: 'Trondheim S' },
  { id: 'NSR:StopPlace:418', name: 'Bergen stasjon' },
  { id: 'NSR:StopPlace:595', name: 'Stavanger stasjon' },
  { id: 'NSR:StopPlace:109', name: 'Bodø stasjon' },
  { id: 'NSR:StopPlace:360', name: 'Kristiansand stasjon' },

  // Important intermediate stations on Oslo-Trondheim route (Dovrebanen)
  { id: 'NSR:StopPlace:552', name: 'Hamar stasjon' },
  { id: 'NSR:StopPlace:59', name: 'Lillehammer stasjon' },
  { id: 'NSR:StopPlace:550', name: 'Eidsvoll stasjon' },
  { id: 'NSR:StopPlace:56', name: 'Dombås stasjon' },
  { id: 'NSR:StopPlace:335', name: 'Oppdal stasjon' },

  // Trønderbanen (Trondheim area)
  { id: 'NSR:StopPlace:585', name: 'Stjørdal stasjon' }, // Changed from 41549 - that was bus station
  { id: 'NSR:StopPlace:555', name: 'Steinkjer stasjon' },
  { id: 'NSR:StopPlace:343', name: 'Levanger stasjon' },
  { id: 'NSR:StopPlace:42722', name: 'Verdal stasjon' },

  // Oslo area and Vestfold line
  { id: 'NSR:StopPlace:551', name: 'Drammen stasjon' },
  { id: 'NSR:StopPlace:592', name: 'Skien stasjon' },
  { id: 'NSR:StopPlace:584', name: 'Porsgrunn stasjon' },
  { id: 'NSR:StopPlace:362', name: 'Larvik stasjon' },
  { id: 'NSR:StopPlace:588', name: 'Sandefjord stasjon' },
  { id: 'NSR:StopPlace:356', name: 'Tønsberg stasjon' },

  // Bergen line
  { id: 'NSR:StopPlace:62', name: 'Voss stasjon' },
  { id: 'NSR:StopPlace:303', name: 'Myrdal stasjon' },
  { id: 'NSR:StopPlace:54', name: 'Finse stasjon' },
  { id: 'NSR:StopPlace:53', name: 'Geilo stasjon' },

  // Sørlandet (southern line)
  { id: 'NSR:StopPlace:4', name: 'Arendal stasjon' },

  // Northern line
  { id: 'NSR:StopPlace:318', name: 'Mosjøen stasjon' },
  { id: 'NSR:StopPlace:317', name: 'Mo i Rana stasjon' },
  { id: 'NSR:StopPlace:49', name: 'Fauske stasjon' },
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
 * Calculate Norwegian timezone offset for a given date
 * Norway uses CET (UTC+1) in winter and CEST (UTC+2) in summer
 */
function getNorwegianTimezoneOffset(dateString: string): string {
  // Create a date at noon UTC for the given date
  const utcDate = new Date(dateString + 'T12:00:00Z');

  // Format this date in Europe/Oslo timezone
  const osloFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Parse the formatted strings to extract hour differences
  const osloParts = osloFormatter.formatToParts(utcDate);
  const utcParts = utcFormatter.formatToParts(utcDate);

  const osloHour = parseInt(osloParts.find(p => p.type === 'hour')?.value || '0');
  const utcHour = parseInt(utcParts.find(p => p.type === 'hour')?.value || '0');

  // Calculate offset (Oslo hour - UTC hour)
  let offsetHours = osloHour - utcHour;

  // Handle day wrap-around
  if (offsetHours > 12) offsetHours -= 24;
  if (offsetHours < -12) offsetHours += 24;

  // Format as +01:00 or +02:00
  const sign = offsetHours >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetHours);
  return `${sign}${String(absOffset).padStart(2, '0')}:00`;
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
  // Automatically handles CET (winter, UTC+1) vs CEST (summer, UTC+2)
  const offset = getNorwegianTimezoneOffset(serviceDate);
  const startTime = `${serviceDate}T00:00:00${offset}`;

  console.log(`[TrainLookup] Searching for ALL departures of train ${trainNumber} on ${serviceDate}`);
  console.log(`[TrainLookup] Using startTime: ${startTime} (offset: ${offset})`);

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

      // Log train numbers if this is Stjørdal or a station with few departures
      if (station.name.includes('Stjørdal') || estimatedCalls.length < 20) {
        const trainNumbers = estimatedCalls.map(call => call.serviceJourney.line.publicCode);
        console.log(`[TrainLookup] Train numbers at ${station.name}:`, trainNumbers.join(', '));
      }

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
