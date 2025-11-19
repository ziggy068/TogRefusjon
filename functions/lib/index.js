"use strict";
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
exports.scheduledDelayCheck = exports.onClaimCreated = exports.ping = exports.auth = exports.db = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const findJourneysToCheck_1 = require("./delay/findJourneysToCheck");
const checkAndStoreDelay_1 = require("./delay/checkAndStoreDelay");
// Initialize Firebase Admin SDK
admin.initializeApp();
// Export Firestore and Auth for use in other functions
exports.db = admin.firestore();
exports.auth = admin.auth();
// Set Firestore to use europe-west1 (implicit via project region)
// Ensure your Firestore database is created in europe-west1
/**
 * Ping function for health checks and emulator verification
 * Region: europe-west1
 */
exports.ping = functions.https.onRequest({
    region: "europe-west1",
    cors: true,
}, (req, res) => {
    res.status(200).json({
        ok: true,
        ts: new Date().toISOString(),
        region: "europe-west1",
        message: "togrefusjon functions operational",
    });
});
/**
 * Example: onCreate trigger for audit logging
 * Writes to audit collection when a claim is created
 */
exports.onClaimCreated = functions.firestore
    .onDocumentCreated({
    document: "claims/{claimId}",
    region: "europe-west1",
}, async (event) => {
    const claimData = event.data?.data();
    if (!claimData)
        return;
    const auditEntry = {
        eventType: "claim.created",
        claimId: event.params.claimId,
        userId: claimData.userId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
            ruleVersion: claimData.ruleVersion,
            status: claimData.status,
        },
        // NO PII (ticket numbers, names, etc.)
    };
    await exports.db.collection("audit").add(auditEntry);
});
/**
 * Scheduled Delay Check (TR-TS-402)
 *
 * Automatically checks delays for relevant journeys every 15 minutes.
 *
 * Runs through:
 * 1. findJourneysToCheck() - Find journeys in time window
 * 2. checkAndStoreDelayForJourneys() - Check delay and save to Firestore
 *
 * Schedule: Every 15 minutes
 * Timezone: Europe/Oslo
 * Region: europe-west1
 */
exports.scheduledDelayCheck = functions.scheduler.onSchedule({
    schedule: "every 15 minutes",
    timeZone: "Europe/Oslo",
    region: "europe-west1",
}, async (event) => {
    logger.info("[ScheduledDelayCheck] Starting automated delay check");
    try {
        // 1. Find journeys that need checking
        const journeys = await (0, findJourneysToCheck_1.findJourneysToCheck)(exports.db, {
            timeWindowStartHours: 6, // Check journeys from 6 hours ago
            timeWindowEndHours: 2, // to 2 hours in the future
            recheckAfterMinutes: 30, // Re-check if last check was >30 min ago
            maxResults: 100, // Limit to 100 journeys per run
        });
        if (journeys.length === 0) {
            logger.info("[ScheduledDelayCheck] No journeys found to check");
            return;
        }
        logger.info(`[ScheduledDelayCheck] Found ${journeys.length} journeys to check`);
        // 2. Check delay and store results
        const summary = await (0, checkAndStoreDelay_1.checkAndStoreDelayForJourneys)(exports.db, journeys);
        logger.info("[ScheduledDelayCheck] Delay check complete:", summary);
        // Log summary for monitoring
        logger.info(`[ScheduledDelayCheck] Summary: ${summary.checked}/${summary.total} checked, ` +
            `${summary.delayed} delayed, ${summary.onTime} on time, ` +
            `${summary.cancelled} cancelled, ${summary.unknown} unknown, ` +
            `${summary.errors} errors`);
    }
    catch (error) {
        logger.error("[ScheduledDelayCheck] Error running scheduled check:", error);
        // Don't throw - let the job complete even if there's an error
    }
});
//# sourceMappingURL=index.js.map