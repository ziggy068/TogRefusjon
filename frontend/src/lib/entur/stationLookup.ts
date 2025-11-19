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
    console.log('[searchStations] Term too short:', searchTerm);
    return [];
  }

  // Use Geocoder API for autocomplete instead of JourneyPlanner
  const GEOCODER_URL = 'https://api.entur.io/geocoder/v1/autocomplete';

  try {
    const params = new URLSearchParams({
      text: searchTerm.trim(),
      size: '15',
      layers: 'venue', // venue = stations/stops
      'boundary.country': 'NOR',
    });

    console.log('[searchStations] Fetching:', `${GEOCODER_URL}?${params}`);

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
    console.log('[searchStations] API returned features:', features.length);

    // Filter to only rail stations based on category
    const railStations = features
      .filter((feature: any) => {
        const category = feature.properties?.category || [];
        // Only include venues categorized as railStation
        return category.includes('railStation');
      })
      .map((feature: any) => ({
        id: feature.properties?.id || '',
        name: feature.properties?.name || '',
        locality: feature.properties?.locality || feature.properties?.county,
      }));

    console.log('[searchStations] Filtered rail stations:', railStations.length);
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
 * @param toStation - Optional: filter to only trains that stop at this station
 * @returns List of train departures
 */
export async function getDeparturesFromStation(
  stationId: string,
  date: string,
  toStation?: string
): Promise<Departure[]> {
  console.log('[getDeparturesFromStation] Fetching departures for:', {
    stationId,
    date,
    toStation
  });

  try {
    // Call our API route instead of calling Entur directly (CORS workaround)
    let url = `/api/entur/departures?stationId=${encodeURIComponent(stationId)}&date=${encodeURIComponent(date)}`;
    if (toStation) {
      url += `&toStation=${encodeURIComponent(toStation)}`;
    }
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[StationDepartures] API error:', error);
      return [];
    }

    const data = await response.json();

    if (!data.stopPlace) {
      console.log('[StationDepartures] No stopPlace in response');
      return [];
    }

    // Filter to only rail transport and non-cancelled
    const trainDepartures = data.stopPlace.estimatedCalls.filter(
      (call: any) =>
        call.serviceJourney.line.transportMode === 'rail' &&
        !call.cancellation
    );

    console.log('[StationDepartures] Found train departures:', trainDepartures.length);

    return trainDepartures.map((call: any) => ({
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
