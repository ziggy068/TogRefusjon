/**
 * Manual Test for scheduledDelayCheck Function (TR-TS-402)
 *
 * Manually triggers the delay checking logic in the emulator
 */

const admin = require('firebase-admin');

// Point to emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.ENTUR_CLIENT_NAME = 'togrefusjon-functions-test';

// Initialize admin SDK
admin.initializeApp({
  projectId: 'togrefusjon',
});

const db = admin.firestore();

// Import the delay checking modules
const { findJourneysToCheck } = require('./lib/delay/findJourneysToCheck');
const { checkAndStoreDelayForJourneys } = require('./lib/delay/checkAndStoreDelay');

async function testScheduledDelayCheck() {
  console.log('[TestDelayCheck] Starting manual test of scheduledDelayCheck...\n');

  try {
    // 1. Find journeys that need checking
    console.log('[TestDelayCheck] Step 1: Finding journeys to check...');
    const journeys = await findJourneysToCheck(db, {
      timeWindowStartHours: 6,
      timeWindowEndHours: 2,
      recheckAfterMinutes: 30,
      maxResults: 100,
    });

    if (journeys.length === 0) {
      console.log('[TestDelayCheck] ❌ No journeys found to check');
      console.log('[TestDelayCheck] Make sure you ran test-data.js first!');
      process.exit(1);
    }

    console.log(`[TestDelayCheck] ✓ Found ${journeys.length} journeys to check:\n`);
    journeys.forEach((j, idx) => {
      console.log(`  ${idx + 1}. ${j.trainNumber} from ${j.fromStopPlaceId} to ${j.toStopPlaceId}`);
      console.log(`     Departure: ${j.plannedDepartureUTC.toISOString()}`);
    });

    // 2. Check delay and store results
    console.log('\n[TestDelayCheck] Step 2: Checking delays and storing results...\n');
    const summary = await checkAndStoreDelayForJourneys(db, journeys);

    // 3. Print summary
    console.log('\n[TestDelayCheck] ✓ Delay check complete!\n');
    console.log('Summary:');
    console.log(`  Total journeys: ${summary.total}`);
    console.log(`  Checked: ${summary.checked}`);
    console.log(`  On time: ${summary.onTime}`);
    console.log(`  Delayed: ${summary.delayed}`);
    console.log(`  Cancelled: ${summary.cancelled}`);
    console.log(`  Unknown: ${summary.unknown}`);
    console.log(`  Errors: ${summary.errors}`);

    // 4. Fetch and display results from Firestore
    console.log('\n[TestDelayCheck] Step 3: Fetching results from Firestore...\n');
    for (const journey of journeys) {
      const docRef = db.collection('journeyInstances').doc(journey.journeyInstanceId);
      const doc = await docRef.get();
      const data = doc.data();

      console.log(`Journey ${journey.journeyInstanceId} (${journey.trainNumber}):`);
      if (data.lastDelayResult) {
        console.log(`  Status: ${data.lastDelayResult.status}`);
        console.log(`  Checked at: ${data.lastDelayResult.checkedAt}`);
        if (data.lastDelayResult.departureDelayMinutes !== undefined) {
          console.log(`  Departure delay: ${data.lastDelayResult.departureDelayMinutes} min`);
        }
        if (data.lastDelayResult.arrivalDelayMinutes !== undefined) {
          console.log(`  Arrival delay: ${data.lastDelayResult.arrivalDelayMinutes} min`);
        }
        if (data.lastDelayResult.message) {
          console.log(`  Message: ${data.lastDelayResult.message}`);
        }
      } else {
        console.log('  No delay result stored');
      }
      console.log('');
    }

    console.log('[TestDelayCheck] ✓ Test complete!\n');
    console.log('Next steps:');
    console.log('1. Check Emulator UI: http://127.0.0.1:4000/firestore');
    console.log('2. Verify lastDelayResult fields in journeyInstances');
    console.log('3. Check function logs in emulator');

  } catch (error) {
    console.error('[TestDelayCheck] ❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testScheduledDelayCheck();
