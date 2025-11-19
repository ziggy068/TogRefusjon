"use strict";
/**
 * Check and Store Delay (TR-TS-402)
 *
 * Batch delay checking and Firestore persistence
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
exports.checkAndStoreDelayForJourney = checkAndStoreDelayForJourney;
exports.checkAndStoreDelayForJourneys = checkAndStoreDelayForJourneys;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const delayCheck_1 = require("./delayCheck");
/**
 * Remove undefined values from object before writing to Firestore
 *
 * @param obj - Object that may contain undefined values
 * @returns Object with undefined values removed
 */
function removeUndefined(obj) {
    const result = {};
    for (const key in obj) {
        if (obj[key] !== undefined) {
            result[key] = obj[key];
        }
    }
    return result;
}
/**
 * Save delay result to Firestore
 *
 * Stores the DelayResult as `lastDelayResult` field on the journeyInstance document.
 *
 * @param db - Firestore database instance
 * @param result - DelayResult from checkDelayForJourney
 * @returns Promise that resolves when save is complete
 */
async function saveDelayResult(db, result) {
    const { journeyInstanceId } = result;
    try {
        const journeyRef = db.collection("journeyInstances").doc(journeyInstanceId);
        // Clean the result to remove undefined values
        const cleanResult = removeUndefined(result);
        // Update journeyInstance with last delay check result
        await journeyRef.update({
            lastDelayResult: cleanResult,
            lastDelayCheckAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info(`[SaveDelay] Saved delay result for journey ${journeyInstanceId}`);
    }
    catch (error) {
        logger.error(`[SaveDelay] Error saving delay result:`, error);
        throw new Error(`Could not save delay result: ${error.message}`);
    }
}
/**
 * Check and store delay for a single journey
 *
 * Wrapper around checkDelayForJourney + saveDelayResult
 *
 * @param db - Firestore database instance
 * @param journey - Journey to check
 * @returns DelayResult
 */
async function checkAndStoreDelayForJourney(db, journey) {
    logger.info(`[CheckAndStore] Checking journey ${journey.journeyInstanceId} (${journey.trainNumber})`);
    try {
        // Check delay via Entur
        const delayResult = await (0, delayCheck_1.checkDelayForJourney)({
            journeyInstanceId: journey.journeyInstanceId,
            trainNumber: journey.trainNumber,
            operatorCode: journey.operator,
            plannedDepartureTime: journey.plannedDepartureUTC.toISOString(),
            plannedArrivalTime: journey.plannedArrivalUTC.toISOString(),
            serviceDate: journey.serviceDate,
            fromStopPlaceId: journey.fromStopPlaceId,
            toStopPlaceId: journey.toStopPlaceId,
        }, "AUTO" // Source: automated check
        );
        // Save result to Firestore
        await saveDelayResult(db, delayResult);
        return delayResult;
    }
    catch (error) {
        logger.error(`[CheckAndStore] Error checking journey ${journey.journeyInstanceId}:`, error);
        // Return UNKNOWN result on error (don't throw - allows batch to continue)
        const errorResult = {
            journeyInstanceId: journey.journeyInstanceId,
            trainNumber: journey.trainNumber,
            operator: journey.operator,
            status: "UNKNOWN",
            checkedAt: new Date().toISOString(),
            source: "AUTO",
            message: `Error: ${error.message}`,
        };
        // Try to save error result to Firestore
        try {
            await saveDelayResult(db, errorResult);
        }
        catch (saveError) {
            logger.error(`[CheckAndStore] Error saving error result:`, saveError);
        }
        return errorResult;
    }
}
/**
 * Check and store delay for multiple journeys (batch)
 *
 * Processes each journey sequentially with robust error handling.
 * Does not stop if one journey fails.
 *
 * @param db - Firestore database instance
 * @param journeys - List of journeys to check
 * @returns Summary of results
 */
async function checkAndStoreDelayForJourneys(db, journeys) {
    logger.info(`[BatchCheck] Starting batch check for ${journeys.length} journeys`);
    const summary = {
        total: journeys.length,
        checked: 0,
        onTime: 0,
        delayed: 0,
        cancelled: 0,
        unknown: 0,
        errors: 0,
    };
    for (const journey of journeys) {
        try {
            const result = await checkAndStoreDelayForJourney(db, journey);
            summary.checked++;
            // Count by status
            if (result.status === "ON_TIME") {
                summary.onTime++;
            }
            else if (result.status === "DELAYED") {
                summary.delayed++;
            }
            else if (result.status === "CANCELLED") {
                summary.cancelled++;
            }
            else if (result.status === "UNKNOWN") {
                summary.unknown++;
            }
            // Check if this was an error (indicated by error message)
            if (result.message?.startsWith("Error:")) {
                summary.errors++;
            }
        }
        catch (error) {
            // This should not happen (checkAndStoreDelayForJourney handles errors internally)
            // But catch it anyway to ensure batch continues
            logger.error(`[BatchCheck] Unexpected error:`, error);
            summary.errors++;
        }
        // Small delay between checks to avoid rate limiting (100ms)
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    logger.info(`[BatchCheck] Batch check complete:`, summary);
    return summary;
}
//# sourceMappingURL=checkAndStoreDelay.js.map