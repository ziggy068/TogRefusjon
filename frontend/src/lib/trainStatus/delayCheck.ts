/**
 * Delay Check Functions (TR-TS-401)
 *
 * On-demand delay checking for train journeys via Entur API
 */

import { getDeparturesForStopPlace, EstimatedCall } from '../enturTog';
import { DelayResult, DelayCheckParams } from './types';

/**
 * Calculate delay in minutes between two ISO timestamps
 *
 * @param planned - Planned time (ISO 8601)
 * @param actual - Actual/expected time (ISO 8601)
 * @returns Delay in minutes (positive = late, negative = early)
 */
function calculateDelayMinutes(planned: string, actual: string): number {
  const plannedTime = new Date(planned).getTime();
  const actualTime = new Date(actual).getTime();
  const diffMs = actualTime - plannedTime;
  return Math.round(diffMs / 60000); // Convert ms to minutes
}

/**
 * Determine delay status from delay minutes
 *
 * @param delayMinutes - Delay in minutes (can be negative)
 * @returns Status classification
 */
function determineStatus(delayMinutes: number | undefined, isCancelled: boolean): DelayResult['status'] {
  if (isCancelled) {
    return 'CANCELLED';
  }

  if (delayMinutes === undefined) {
    return 'UNKNOWN';
  }

  // ON_TIME: between -1 and +1 minute
  if (delayMinutes >= -1 && delayMinutes <= 1) {
    return 'ON_TIME';
  }

  // DELAYED: 1 minute or more late
  if (delayMinutes >= 1) {
    return 'DELAYED';
  }

  // Early trains are also considered ON_TIME for now
  return 'ON_TIME';
}

/**
 * Find matching train in departures list
 *
 * @param calls - List of estimated calls from Entur
 * @param trainNumber - Train number to match
 * @param plannedDepartureTime - Optional planned time for better matching
 * @returns Matching call or null
 */
function findMatchingTrain(
  calls: EstimatedCall[],
  trainNumber: string,
  plannedDepartureTime?: string
): EstimatedCall | null {
  // Filter by train number (case-insensitive)
  const matchingTrains = calls.filter(
    (call) => call.serviceJourney.line.publicCode.toUpperCase() === trainNumber.toUpperCase()
  );

  if (matchingTrains.length === 0) {
    return null;
  }

  // If only one match, return it
  if (matchingTrains.length === 1) {
    return matchingTrains[0];
  }

  // Multiple matches - try to find closest to planned time
  if (plannedDepartureTime) {
    const plannedTime = new Date(plannedDepartureTime).getTime();
    matchingTrains.sort((a, b) => {
      const aTime = new Date(a.aimedDepartureTime || a.expectedDepartureTime || '').getTime();
      const bTime = new Date(b.aimedDepartureTime || b.expectedDepartureTime || '').getTime();
      const aDiff = Math.abs(aTime - plannedTime);
      const bDiff = Math.abs(bTime - plannedTime);
      return aDiff - bDiff;
    });
  }

  // Return closest match
  return matchingTrains[0];
}

/**
 * Check delay for a journey (TR-TS-401)
 *
 * Queries Entur API to get real-time data for a train journey and calculates delay.
 *
 * @param params - Journey parameters
 * @returns DelayResult with status and delay information
 */
export async function checkDelayForJourney(
  params: DelayCheckParams
): Promise<DelayResult> {
  const {
    journeyInstanceId,
    trainNumber,
    operatorCode,
    plannedDepartureTime,
    plannedArrivalTime,
    serviceDate,
    fromStopPlaceId,
    toStopPlaceId,
  } = params;

  console.log(`[DelayCheck] Checking delay for journey ${journeyInstanceId}, train ${trainNumber}`);

  // Build initial result (will be populated as we go)
  const result: DelayResult = {
    journeyInstanceId,
    trainNumber: trainNumber || 'UNKNOWN',
    operator: operatorCode,
    plannedDepartureTime,
    plannedArrivalTime,
    status: 'UNKNOWN',
    checkedAt: new Date().toISOString(),
  };

  try {
    // Validate required params
    if (!fromStopPlaceId) {
      result.message = 'Missing fromStopPlaceId - cannot query Entur';
      console.warn(`[DelayCheck] ${result.message}`);
      return result;
    }

    if (!trainNumber) {
      result.message = 'Missing trainNumber - cannot query Entur';
      console.warn(`[DelayCheck] ${result.message}`);
      return result;
    }

    // Get departures from origin station
    const departures = await getDeparturesForStopPlace(fromStopPlaceId, 100);
    console.log(`[DelayCheck] Got ${departures.estimatedCalls.length} departures from ${fromStopPlaceId}`);

    // Find matching train
    const matchingCall = findMatchingTrain(
      departures.estimatedCalls,
      trainNumber,
      plannedDepartureTime
    );

    if (!matchingCall) {
      result.message = `Train ${trainNumber} not found in departures`;
      console.warn(`[DelayCheck] ${result.message}`);
      return result;
    }

    console.log(`[DelayCheck] Found matching train: ${matchingCall.serviceJourney.line.publicCode}`);

    // Extract times from Entur data
    const aimedDeparture = matchingCall.aimedDepartureTime;
    const expectedDeparture = matchingCall.expectedDepartureTime;
    const actualDeparture = matchingCall.actualDepartureTime;
    const aimedArrival = matchingCall.aimedArrivalTime;
    const expectedArrival = matchingCall.expectedArrivalTime;
    const actualArrival = matchingCall.actualArrivalTime;
    const isCancelled = matchingCall.cancellation || false;

    // Populate result with times
    result.plannedDepartureTime = aimedDeparture || plannedDepartureTime;
    result.plannedArrivalTime = aimedArrival || plannedArrivalTime;
    result.actualDepartureTime = actualDeparture || expectedDeparture;
    result.actualArrivalTime = actualArrival || expectedArrival;

    // Calculate delays
    if (aimedDeparture && (actualDeparture || expectedDeparture)) {
      result.departureDelayMinutes = calculateDelayMinutes(
        aimedDeparture,
        actualDeparture || expectedDeparture!
      );
    }

    if (aimedArrival && (actualArrival || expectedArrival)) {
      result.arrivalDelayMinutes = calculateDelayMinutes(
        aimedArrival,
        actualArrival || expectedArrival!
      );
    }

    // Determine overall status (prioritize arrival delay)
    result.status = determineStatus(
      result.arrivalDelayMinutes ?? result.departureDelayMinutes,
      isCancelled
    );

    // Store raw Entur data for debugging
    result.rawEntur = matchingCall;

    // Set message
    if (result.status === 'CANCELLED') {
      result.message = 'Toget er kansellert';
    } else if (result.status === 'DELAYED') {
      const delayMins = result.arrivalDelayMinutes ?? result.departureDelayMinutes ?? 0;
      result.message = `Toget er forsinket ${delayMins} minutter`;
    } else if (result.status === 'ON_TIME') {
      result.message = 'Toget er i rute';
    } else {
      result.message = 'Kunne ikke bestemme forsinkelse';
    }

    console.log(`[DelayCheck] Result: ${result.status} - ${result.message}`);

    return result;
  } catch (error: any) {
    // Handle errors gracefully - don't throw, return UNKNOWN status
    console.error('[DelayCheck] Error checking delay:', error);
    result.status = 'UNKNOWN';
    result.message = 'Feil ved henting av forsinkelsesdata';
    return result;
  }
}
