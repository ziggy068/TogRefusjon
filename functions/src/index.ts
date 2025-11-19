import * as functions from "firebase-functions/v2";
  import * as admin from "firebase-admin";
  import * as logger from "firebase-functions/logger";
  import {findJourneysToCheck} from "./delay/findJourneysToCheck";
  import {checkAndStoreDelayForJourneys} from "./delay/checkAndStoreDelay";

  // Initialize Firebase Admin SDK
  admin.initializeApp();

  // Export Firestore and Auth for use in other functions
  export const db = admin.firestore();
  export const auth = admin.auth();

  // Set Firestore to use europe-west1 (implicit via project region)
  // Ensure your Firestore database is created in europe-west1

  /**
   * Ping function for health checks and emulator verification
   * Region: europe-west1
   */
  export const ping = functions.https.onRequest(
    {
      region: "europe-west1",
      cors: true,
    },
    (req, res) => {
      res.status(200).json({
        ok: true,
        ts: new Date().toISOString(),
        region: "europe-west1",
        message: "togrefusjon functions operational",
      });
    }
  );

  /**
   * Example: onCreate trigger for audit logging
   * Writes to audit collection when a claim is created
   */
  export const onClaimCreated = functions.firestore
    .onDocumentCreated(
      {
        document: "claims/{claimId}",
        region: "europe-west1",
      },
      async (event) => {
        const claimData = event.data?.data();
        if (!claimData) return;

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

        await db.collection("audit").add(auditEntry);
      }
    );

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
  export const scheduledDelayCheck = functions.scheduler.onSchedule(
    {
      schedule: "every 15 minutes",
      timeZone: "Europe/Oslo",
      region: "europe-west1",
    },
    async (event) => {
      logger.info("[ScheduledDelayCheck] Starting automated delay check");

      try {
        // 1. Find journeys that need checking
        const journeys = await findJourneysToCheck(db, {
          timeWindowStartHours: 6, // Check journeys from 6 hours ago
          timeWindowEndHours: 2, // to 2 hours in the future
          recheckAfterMinutes: 30, // Re-check if last check was >30 min ago
          maxResults: 100, // Limit to 100 journeys per run
        });

        if (journeys.length === 0) {
          logger.info("[ScheduledDelayCheck] No journeys found to check");
          return;
        }

        logger.info(
          `[ScheduledDelayCheck] Found ${journeys.length} journeys to check`
        );

        // 2. Check delay and store results
        const summary = await checkAndStoreDelayForJourneys(db, journeys);

        logger.info("[ScheduledDelayCheck] Delay check complete:", summary);

        // Log summary for monitoring
        logger.info(
          `[ScheduledDelayCheck] Summary: ${summary.checked}/${summary.total} checked, ` +
          `${summary.delayed} delayed, ${summary.onTime} on time, ` +
          `${summary.cancelled} cancelled, ${summary.unknown} unknown, ` +
          `${summary.errors} errors`
        );
      } catch (error: any) {
        logger.error("[ScheduledDelayCheck] Error running scheduled check:", error);
        // Don't throw - let the job complete even if there's an error
      }
    }
  );
