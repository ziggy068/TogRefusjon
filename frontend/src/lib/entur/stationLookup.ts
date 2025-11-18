/**
 * Station lookup and autocomplete (TR-IM-310)
 *
 * Search for stations by name and get departures from a specific station
 */

import { enturQuery } from '../enturClient';

export interface StationSuggestion {
  id: string;
  name: string;
  locality?: string; // e.g., "Oslo", "Trondheim"
}

export interface Departure {
  trainNumber: string;
  operator: string;
  destination: string;
  departureTime: string;
  platform?: string;
  serviceJourneyId: string;
}

/**
 * Search for stations by name (autocomplete)
 * Returns matching stations as user types
 */
export async function searchStations(searchTerm: string): Promise<StationSuggestion[]> {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return [];
  }

  // Use Geocoder API for autocomplete instead of JourneyPlanner
  const GEOCODER_URL = 'https://api.entur.io/geocoder/v1/autocomplete';

  try {
    const params = new URLSearchParams({
      text: searchTerm.trim(),
      size: '10',
      layers: 'venue', // venue = stations/stops
      'boundary.country': 'NOR',
    });

    const response = await fetch(`${GEOCODER_URL}?${params}`, {
      headers: {
        'ET-Client-Name': 'togrefusjon-webapp',
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoder API error: ${response.status}`);
    }

    const data = await response.json();
    const features = data.features || [];

    // Filter to only rail stations and convert to our format
    const railStations = features
      .filter((feature: any) => {
        const name = feature.properties?.name?.toLowerCase() || '';
        const category = feature.properties?.category || [];
        return (
          name.includes('stasjon') ||
          name.includes('station') ||
          category.includes('railStation')
        );
      })
      .map((feature: any) => ({
        id: feature.properties?.id || '',
        name: feature.properties?.name || '',
        locality: feature.properties?.locality || feature.properties?.county,
      }));

    return railStations;
  } catch (error: any) {
    console.error('[StationSearch] Error searching stations:', error);
    return [];
  }
}

/**
 * Get train departures from a specific station
 *
 * @param stationId - NSR ID of the station (e.g., "NSR:StopPlace:548")
 * @param date - Date in YYYY-MM-DD format
 * @returns List of train departures
 */
export async function getDeparturesFromStation(
  stationId: string,
  date: string
): Promise<Departure[]> {
  const DEPARTURES_QUERY = `
    query GetDepartures($stopPlaceId: String!, $startTime: DateTime!, $numberOfDepartures: Int!) {
      stopPlace(id: $stopPlaceId) {
        id
        name
        estimatedCalls(startTime: $startTime, numberOfDepartures: $numberOfDepartures, timeRange: 86400) {
          aimedDepartureTime
          expectedDepartureTime
          cancellation
          quay {
            publicCode
          }
          destinationDisplay {
            frontText
          }
          serviceJourney {
            id
            line {
              publicCode
              transportMode
              authority {
                name
              }
            }
          }
        }
      }
    }
  `;

  // Calculate timezone offset
  const offset = getNorwegianTimezoneOffset(date);
  const startTime = `${date}T00:00:00${offset}`;

  try {
    const response = await enturQuery<{
      stopPlace: {
        id: string;
        name: string;
        estimatedCalls: Array<{
          aimedDepartureTime: string;
          expectedDepartureTime?: string;
          cancellation: boolean;
          quay?: {
            publicCode?: string;
          };
          destinationDisplay?: {
            frontText?: string;
          };
          serviceJourney: {
            id: string;
            line: {
              publicCode: string;
              transportMode?: string;
              authority?: {
                name?: string;
              };
            };
          };
        }>;
      };
    }>(DEPARTURES_QUERY, {
      stopPlaceId: stationId,
      startTime,
      numberOfDepartures: 200,
    });

    if (!response.stopPlace) {
      return [];
    }

    // Filter to only trains (rail transport mode)
    const trainDepartures = response.stopPlace.estimatedCalls.filter(
      (call) =>
        call.serviceJourney.line.transportMode === 'rail' &&
        !call.cancellation
    );

    return trainDepartures.map((call) => ({
      trainNumber: call.serviceJourney.line.publicCode,
      operator: call.serviceJourney.line.authority?.name || 'Ukjent',
      destination: call.destinationDisplay?.frontText || 'Ukjent',
      departureTime: call.expectedDepartureTime || call.aimedDepartureTime,
      platform: call.quay?.publicCode,
      serviceJourneyId: call.serviceJourney.id,
    }));
  } catch (error: any) {
    console.error('[StationDepartures] Error fetching departures:', error);
    return [];
  }
}

/**
 * Calculate Norwegian timezone offset for a given date
 * Norway uses CET (UTC+1) in winter and CEST (UTC+2) in summer
 */
function getNorwegianTimezoneOffset(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00');

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const osloDate = new Date(formatter.format(date));
  const utcDate = new Date(date.toISOString());

  const offsetMs = osloDate.getTime() - utcDate.getTime();
  const offsetHours = Math.round(offsetMs / (1000 * 60 * 60));

  const sign = offsetHours >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetHours);
  return `${sign}${String(absOffset).padStart(2, '0')}:00`;
}
