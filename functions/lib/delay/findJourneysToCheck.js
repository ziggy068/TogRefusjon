"use strict";
/**
 * Find Journeys To Check (TR-TS-402)
 *
 * Query Firestore for journeyInstances that need delay checking
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
exports.findJourneysToCheck = findJourneysToCheck;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
/**
 * Find journey instances that need delay checking
 *
 * Strategy (MVP):
 * - Find journeys where departureTime is in window: (now - 6h) to (now + 2h)
 * - AND either:
 *   - lastDelayCheckAt is null/undefined
 *   - OR lastDelayCheckAt is older than 30 minutes
 *
 * @param db - Firestore database instance
 * @param options - Query options
 * @returns List of journeys that need checking
 */
async function findJourneysToCheck(db, options = {}) {
    const { timeWindowStartHours = 6, timeWindowEndHours = 2, recheckAfterMinutes = 30, maxResults = 100, } = options;
    const now = new Date();
    const startTime = new Date(now.getTime() - timeWindowStartHours * 60 * 60 * 1000);
    const endTime = new Date(now.getTime() + timeWindowEndHours * 60 * 60 * 1000);
    const recheckThreshold = new Date(now.getTime() - recheckAfterMinutes * 60 * 1000);
    logger.info(`[FindJourneys] Searching for journeys between ${startTime.toISOString()} and ${endTime.toISOString()}`);
    logger.info(`[FindJourneys] Re-check threshold: ${recheckThreshold.toISOString()}`);
    try {
        // Query journeys in time window
        // Note: Firestore queries are limited - we query by departureTime range
        // and filter by lastDelayCheckAt in code
        const journeysQuery = db
            .collection("journeyInstances")
            .where("plannedDepartureUTC", ">=", admin.firestore.Timestamp.fromDate(startTime))
            .where("plannedDepartureUTC", "<=", admin.firestore.Timestamp.fromDate(endTime))
            .limit(maxResults * 2); // Fetch more to account for filtering
        const snapshot = await journeysQuery.get();
        logger.info(`[FindJourneys] Found ${snapshot.size} journeys in time window`);
        const journeysToCheck = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Check if we should skip this journey based on lastDelayCheckAt
            if (data.lastDelayCheckAt) {
                const lastCheck = data.lastDelayCheckAt.toDate();
                if (lastCheck > recheckThreshold) {
                    // Skip - recently checked
                    return;
                }
            }
            // Extract journey data
            const journey = {
                journeyInstanceId: doc.id,
                trainNumber: data.trainNumber || "",
                operator: data.operator || "",
                serviceDate: data.serviceDate || "",
                fromStopPlaceId: data.fromStopPlaceId || "",
                toStopPlaceId: data.toStopPlaceId || "",
                plannedDepartureUTC: data.plannedDepartureUTC?.toDate() || new Date(),
                plannedArrivalUTC: data.plannedArrivalUTC?.toDate() || new Date(),
                lastDelayCheckAt: data.lastDelayCheckAt?.toDate(),
            };
            // Validate required fields
            if (journey.trainNumber &&
                journey.fromStopPlaceId &&
                journey.serviceDate) {
                journeysToCheck.push(journey);
            }
            else {
                logger.warn(`[FindJourneys] Skipping journey ${doc.id} - missing required fields`);
            }
        });
        // Apply max results limit after filtering
        const limitedJourneys = journeysToCheck.slice(0, maxResults);
        logger.info(`[FindJourneys] Found ${limitedJourneys.length} journeys that need checking`);
        return limitedJourneys;
    }
    catch (error) {
        logger.error("[FindJourneys] Error querying journeys:", error);
        throw new Error(`Failed to find journeys to check: ${error.message}`);
    }
}
//# sourceMappingURL=findJourneysToCheck.js.map