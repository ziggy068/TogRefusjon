"use strict";
/**
 * Entur API Client for Cloud Functions (TR-TS-402)
 *
 * Server-side GraphQL client for querying Entur JourneyPlanner API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeparturesForStopPlace = getDeparturesForStopPlace;
const ENTUR_GRAPHQL_URL = 'https://api.entur.io/journey-planner/v3/graphql';
/**
 * Get departures from a stop place
 *
 * @param stopPlaceId - NSR stop place ID (e.g., "NSR:StopPlace:548")
 * @param numberOfDepartures - Number of departures to fetch (default: 100)
 * @returns Departures response from Entur
 */
async function getDeparturesForStopPlace(stopPlaceId, numberOfDepartures = 100) {
    const DEPARTURES_QUERY = `
    query GetDepartures($stopPlaceId: String!, $numberOfDepartures: Int!) {
      stopPlace(id: $stopPlaceId) {
        id
        name
        estimatedCalls(numberOfDepartures: $numberOfDepartures) {
          aimedDepartureTime
          expectedDepartureTime
          actualDepartureTime
          aimedArrivalTime
          expectedArrivalTime
          actualArrivalTime
          cancellation
          serviceJourney {
            id
            line {
              id
              publicCode
              name
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
    const response = await fetch(ENTUR_GRAPHQL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ET-Client-Name': process.env.ENTUR_CLIENT_NAME || 'togrefusjon-functions',
        },
        body: JSON.stringify({
            query: DEPARTURES_QUERY,
            variables: {
                stopPlaceId,
                numberOfDepartures,
            },
        }),
    });
    if (!response.ok) {
        throw new Error(`Entur API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data.errors) {
        throw new Error(`Entur GraphQL errors: ${JSON.stringify(data.errors)}`);
    }
    if (!data.data?.stopPlace) {
        throw new Error(`No stop place found for ID: ${stopPlaceId}`);
    }
    return data.data;
}
//# sourceMappingURL=enturClient.js.map