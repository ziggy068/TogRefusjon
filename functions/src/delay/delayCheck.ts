/**
 * Delay Check Functions for Cloud Functions (TR-TS-402)
 *
 * Server-side delay checking for automated monitoring
 */

import {getDeparturesForStopPlace, EstimatedCall} from "../entur/enturClient";
import {DelayResult, DelayCheckParams} from "./types";
import * as logger from "firebase-functions/logger";

/**
 * Calculate delay in minutes between two ISO timestamps
 */
function calculateDelayMinutes(planned: string, actual: string): number {
  const plannedTime = new Date(planned).getTime();
  const actualTime = new Date(actual).getTime();
  const diffMs = actualTime - plannedTime;
  return Math.round(diffMs / 60000);
}

/**
 * Determine delay status from delay minutes
 */
function determineStatus(
  delayMinutes: number | undefined,
  isCancelled: boolean
): DelayResult["status"] {
  if (isCancelled) {
    return "CANCELLED";
  }

  if (delayMinutes === undefined) {
    return "UNKNOWN";
  }

  // ON_TIME: between -1 and +1 minute
  if (delayMinutes >= -1 && delayMinutes <= 1) {
    return "ON_TIME";
  }

  // DELAYED: more than 1 minute late
  if (delayMinutes > 1) {
    return "DELAYED";
  }

  // Early trains are also considered ON_TIME
  return "ON_TIME";
}

/**
 * Find matching train in departures list
 */
function findMatchingTrain(
  calls: EstimatedCall[],
  trainNumber: string,
  plannedDepartureTime?: string
): EstimatedCall | null {
  // Filter by train number (case-insensitive)
  const matchingTrains = calls.filter(
    (call) =>
      call.serviceJourney.line.publicCode.toUpperCase() ===
      trainNumber.toUpperCase()
  );

  if (matchingTrains.length === 0) {
    return null;
  }

  if (matchingTrains.length === 1) {
    return matchingTrains[0];
  }

  // Multiple matches - find closest to planned time
  if (plannedDepartureTime) {
    const plannedTime = new Date(plannedDepartureTime).getTime();
    matchingTrains.sort((a, b) => {
      const aTime = new Date(
        a.aimedDepartureTime || a.expectedDepartureTime || ""
      ).getTime();
      const bTime = new Date(
        b.aimedDepartureTime || b.expectedDepartureTime || ""
      ).getTime();
      const aDiff = Math.abs(aTime - plannedTime);
      const bDiff = Math.abs(bTime - plannedTime);
      return aDiff - bDiff;
    });
  }

  return matchingTrains[0];
}

/**
 * Check delay for a journey (server-side version for TR-TS-402)
 *
 * @param params - Journey parameters
 * @param source - Source of check (AUTO for scheduled, MANUAL for on-demand)
 * @returns DelayResult with status and delay information
 */
export async function checkDelayForJourney(
  params: DelayCheckParams,
  source: "AUTO" | "MANUAL" = "AUTO"
): Promise<DelayResult> {
  const {
    journeyInstanceId,
    trainNumber,
    operatorCode,
    plannedDepartureTime,
    plannedArrivalTime,
    fromStopPlaceId,
  } = params;

  logger.info(
    `[DelayCheck] Checking delay for journey ${journeyInstanceId}, train ${trainNumber} (source: ${source})`
  );

  // Build initial result
  const result: DelayResult = {
    journeyInstanceId,
    trainNumber: trainNumber || "UNKNOWN",
    operator: operatorCode,
    plannedDepartureTime,
    plannedArrivalTime,
    status: "UNKNOWN",
    checkedAt: new Date().toISOString(),
    source,
  };

  try {
    // Validate required params
    if (!fromStopPlaceId) {
      result.message = "Missing fromStopPlaceId - cannot query Entur";
      logger.warn(`[DelayCheck] ${result.message}`);
      return result;
    }

    if (!trainNumber) {
      result.message = "Missing trainNumber - cannot query Entur";
      logger.warn(`[DelayCheck] ${result.message}`);
      return result;
    }

    // Get departures from origin station
    const departures = await getDeparturesForStopPlace(fromStopPlaceId, 100);
    logger.info(
      `[DelayCheck] Got ${departures.stopPlace.estimatedCalls.length} departures from ${fromStopPlaceId}`
    );

    // Find matching train
    const matchingCall = findMatchingTrain(
      departures.stopPlace.estimatedCalls,
      trainNumber,
      plannedDepartureTime
    );

    if (!matchingCall) {
      result.message = `Train ${trainNumber} not found in departures`;
      logger.warn(`[DelayCheck] ${result.message}`);
      return result;
    }

    logger.info(
      `[DelayCheck] Found matching train: ${matchingCall.serviceJourney.line.publicCode}`
    );

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

    // Store trimmed raw data (not full Entur response)
    result.rawEntur = {
      serviceJourneyId: matchingCall.serviceJourney.id,
      lineId: matchingCall.serviceJourney.line.id,
      publicCode: matchingCall.serviceJourney.line.publicCode,
      destination: matchingCall.destinationDisplay?.frontText,
    };

    // Set message
    if (result.status === "CANCELLED") {
      result.message = "Toget er kansellert";
    } else if (result.status === "DELAYED") {
      const delayMins = result.arrivalDelayMinutes ?? result.departureDelayMinutes ?? 0;
      result.message = `Toget er forsinket ${delayMins} minutter`;
    } else if (result.status === "ON_TIME") {
      result.message = "Toget er i rute";
    } else {
      result.message = "Kunne ikke bestemme forsinkelse";
    }

    logger.info(`[DelayCheck] Result: ${result.status} - ${result.message}`);

    return result;
  } catch (error: any) {
    // Handle errors gracefully - don't throw, return UNKNOWN status
    logger.error("[DelayCheck] Error checking delay:", error);
    result.status = "UNKNOWN";
    result.message = `Feil ved henting av forsinkelsesdata: ${error.message}`;
    return result;
  }
}
