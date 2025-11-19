import { NextRequest, NextResponse } from 'next/server';

const ENTUR_GRAPHQL_URL = 'https://api.entur.io/journey-planner/v3/graphql';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const stationId = searchParams.get('stationId');
  const date = searchParams.get('date');
  const toStation = searchParams.get('toStation'); // Optional: filter by destination station

  if (!stationId || !date) {
    return NextResponse.json(
      { error: 'Missing stationId or date parameter' },
      { status: 400 }
    );
  }

  const DEPARTURES_QUERY = `
    query GetDepartures($stopPlaceId: String!, $startTime: DateTime!, $numberOfDepartures: Int!) {
      stopPlace(id: $stopPlaceId) {
        id
        name
        estimatedCalls(startTime: $startTime, numberOfDepartures: $numberOfDepartures) {
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
            estimatedCalls {
              quay {
                stopPlace {
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  // Calculate Norwegian timezone offset
  const offset = getNorwegianTimezoneOffset(date);
  const startTime = `${date}T00:00:00${offset}`;

  try {
    const response = await fetch(ENTUR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ET-Client-Name': process.env.NEXT_PUBLIC_ENTUR_CLIENT_NAME || 'togrefusjon-dev',
      },
      body: JSON.stringify({
        query: DEPARTURES_QUERY,
        variables: {
          stopPlaceId: stationId,
          startTime,
          numberOfDepartures: 2000,
        },
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Entur API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.errors) {
      return NextResponse.json(
        { error: 'GraphQL errors', details: data.errors },
        { status: 500 }
      );
    }

    // Filter departures by toStation if provided
    if (toStation && data.data?.stopPlace?.estimatedCalls) {
      const fromStationName = data.data.stopPlace.name;
      const totalDepartures = data.data.stopPlace.estimatedCalls.length;
      console.log('[API] Filtering departures from:', fromStationName, 'to:', toStation);
      console.log(`[API] Total departures returned by API: ${totalDepartures}`);

      // Log how many R70 trains we got before filtering
      const r70Count = data.data.stopPlace.estimatedCalls.filter((call: any) =>
        call.serviceJourney.line.publicCode === 'R70'
      ).length;
      console.log(`[API] Total R70 trains before filtering: ${r70Count}`);

      // Log first and last R70 departure times
      const r70Trains = data.data.stopPlace.estimatedCalls.filter((call: any) =>
        call.serviceJourney.line.publicCode === 'R70'
      );
      if (r70Trains.length > 0) {
        const firstR70 = r70Trains[0].aimedDepartureTime;
        const lastR70 = r70Trains[r70Trains.length - 1].aimedDepartureTime;
        console.log(`[API] R70 time range: ${firstR70} to ${lastR70}`);
      }

      const filteredCalls = data.data.stopPlace.estimatedCalls.filter((call: any) => {
        // Get all stops for this service journey
        const allStops = call.serviceJourney?.estimatedCalls || [];

        // Find the FIRST occurrence of from-station
        const fromStationIndex = allStops.findIndex((stop: any) => {
          const stopName = stop.quay?.stopPlace?.name || '';
          return stopName.toLowerCase().includes(fromStationName.toLowerCase());
        });

        // Find the FIRST occurrence of to-station AFTER from-station
        let toStationIndex = -1;
        if (fromStationIndex !== -1) {
          for (let i = fromStationIndex + 1; i < allStops.length; i++) {
            const stopName = allStops[i].quay?.stopPlace?.name || '';
            if (stopName.toLowerCase().includes(toStation.toLowerCase())) {
              toStationIndex = i;
              break; // Found first occurrence after fromStation
            }
          }
        }

        // Only include if train stops at toStation AFTER fromStation
        const isValidRoute = fromStationIndex !== -1 && toStationIndex !== -1;

        const transportMode = call.serviceJourney?.line?.transportMode || 'unknown';
        const trainNumber = call.serviceJourney.line.publicCode;

        // Only log R70 trains to reduce noise
        if (trainNumber === 'R70') {
          if (isValidRoute) {
            console.log(`[API] ✓ R70 stops at ${toStation} (from index ${fromStationIndex} to ${toStationIndex}) [mode: ${transportMode}]`);
          } else if (toStationIndex !== -1 && fromStationIndex !== -1) {
            console.log(`[API] ✗ R70 has wrong direction (from index ${fromStationIndex}, to index ${toStationIndex}) [mode: ${transportMode}]`);
          } else if (fromStationIndex === -1) {
            console.log(`[API] ✗ R70 doesn't depart from ${fromStationName} [mode: ${transportMode}]`);
          } else {
            const stopNames = allStops.map((s: any) => s.quay?.stopPlace?.name || 'Unknown').join(' → ');
            console.log(`[API] ✗ R70 doesn't stop at ${toStation} [mode: ${transportMode}]. Route: ${stopNames}`);
          }
        }

        return isValidRoute;
      });

      console.log(`[API] Filtered from ${data.data.stopPlace.estimatedCalls.length} to ${filteredCalls.length} departures`);
      data.data.stopPlace.estimatedCalls = filteredCalls;
    }

    return NextResponse.json(data.data);
  } catch (error: any) {
    console.error('[API] Entur departures error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch departures', details: error.message },
      { status: 500 }
    );
  }
}

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
