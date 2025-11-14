import * as functions from "firebase-functions/v2";
  import * as admin from "firebase-admin";

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
