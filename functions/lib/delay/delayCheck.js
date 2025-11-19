"use strict";
/**
 * Delay Check Functions for Cloud Functions (TR-TS-402)
 *
 * Server-side delay checking for automated monitoring
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDelayForJourney = checkDelayForJourney;
const enturClient_1 = require("../entur/enturClient");
const logger = __importStar(require("firebase-functions/logger"));
/**
 * Calculate delay in minutes between two ISO timestamps
 */
function calculateDelayMinutes(planned, actual) {
    const plannedTime = new Date(planned).getTime();
    const actualTime = new Date(actual).getTime();
    const diffMs = actualTime - plannedTime;
    return Math.round(diffMs / 60000);
}
/**
 * Determine delay status from delay minutes
 */
function determineStatus(delayMinutes, isCancelled) {
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
function findMatchingTrain(calls, trainNumber, plannedDepartureTime) {
    // Filter by train number (case-insensitive)
    const matchingTrains = calls.filter((call) => call.serviceJourney.line.publicCode.toUpperCase() ===
        trainNumber.toUpperCase());
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
            const aTime = new Date(a.aimedDepartureTime || a.expectedDepartureTime || "").getTime();
            const bTime = new Date(b.aimedDepartureTime || b.expectedDepartureTime || "").getTime();
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
async function checkDelayForJourney(params, source = "AUTO") {
    const { journeyInstanceId, trainNumber, operatorCode, plannedDepartureTime, plannedArrivalTime, fromStopPlaceId, } = params;
    logger.info(`[DelayCheck] Checking delay for journey ${journeyInstanceId}, train ${trainNumber} (source: ${source})`);
    // Build initial result
    const result = {
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
        const departures = await (0, enturClient_1.getDeparturesForStopPlace)(fromStopPlaceId, 100);
        logger.info(`[DelayCheck] Got ${departures.stopPlace.estimatedCalls.length} departures from ${fromStopPlaceId}`);
        // Find matching train
        const matchingCall = findMatchingTrain(departures.stopPlace.estimatedCalls, trainNumber, plannedDepartureTime);
        if (!matchingCall) {
            result.message = `Train ${trainNumber} not found in departures`;
            logger.warn(`[DelayCheck] ${result.message}`);
            return result;
        }
        logger.info(`[DelayCheck] Found matching train: ${matchingCall.serviceJourney.line.publicCode}`);
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
            result.departureDelayMinutes = calculateDelayMinutes(aimedDeparture, actualDeparture || expectedDeparture);
        }
        if (aimedArrival && (actualArrival || expectedArrival)) {
            result.arrivalDelayMinutes = calculateDelayMinutes(aimedArrival, actualArrival || expectedArrival);
        }
        // Determine overall status (prioritize arrival delay)
        result.status = determineStatus(result.arrivalDelayMinutes ?? result.departureDelayMinutes, isCancelled);
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
        }
        else if (result.status === "DELAYED") {
            const delayMins = result.arrivalDelayMinutes ?? result.departureDelayMinutes ?? 0;
            result.message = `Toget er forsinket ${delayMins} minutter`;
        }
        else if (result.status === "ON_TIME") {
            result.message = "Toget er i rute";
        }
        else {
            result.message = "Kunne ikke bestemme forsinkelse";
        }
        logger.info(`[DelayCheck] Result: ${result.status} - ${result.message}`);
        return result;
    }
    catch (error) {
        // Handle errors gracefully - don't throw, return UNKNOWN status
        logger.error("[DelayCheck] Error checking delay:", error);
        result.status = "UNKNOWN";
        result.message = `Feil ved henting av forsinkelsesdata: ${error.message}`;
        return result;
    }
}
//# sourceMappingURL=delayCheck.js.map