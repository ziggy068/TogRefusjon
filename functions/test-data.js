/**
 * Test Data Generator for TR-TS-402
 *
 * Creates test journey instances in Firestore emulator
 */

const admin = require('firebase-admin');

// Initialize admin SDK for emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({
  projectId: 'togrefusjon',
});

const db = admin.firestore();

async function createTestJourneys() {
  console.log('[TestData] Creating test journeys...');

  // Test journey 1: Trondheim S to Stjørdal (R70 train departing today)
  const now = new Date();
  const departureTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
  const arrivalTime = new Date(departureTime.getTime() + 20 * 60 * 1000); // 20 minutes later

  const testJourney1 = {
    trainNumber: 'R70',
    operator: 'go-ahead',
    serviceDate: departureTime.toISOString().split('T')[0], // YYYY-MM-DD
    fromStopPlaceId: 'NSR:StopPlace:41137', // Trondheim S
    toStopPlaceId: 'NSR:StopPlace:42607', // Stjørdal stasjon
    plannedDepartureUTC: admin.firestore.Timestamp.fromDate(departureTime),
    plannedArrivalUTC: admin.firestore.Timestamp.fromDate(arrivalTime),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Test journey 2: Older journey (should not be checked - outside time window)
  const oldDepartureTime = new Date(now.getTime() - 8 * 60 * 60 * 1000); // 8 hours ago
  const oldArrivalTime = new Date(oldDepartureTime.getTime() + 20 * 60 * 1000);

  const testJourney2 = {
    trainNumber: 'R11',
    operator: 'vy',
    serviceDate: oldDepartureTime.toISOString().split('T')[0],
    fromStopPlaceId: 'NSR:StopPlace:337', // Oslo S
    toStopPlaceId: 'NSR:StopPlace:548', // Drammen
    plannedDepartureUTC: admin.firestore.Timestamp.fromDate(oldDepartureTime),
    plannedArrivalUTC: admin.firestore.Timestamp.fromDate(oldArrivalTime),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Test journey 3: Journey departing soon (5 minutes from now)
  const soonDepartureTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
  const soonArrivalTime = new Date(soonDepartureTime.getTime() + 15 * 60 * 1000);

  const testJourney3 = {
    trainNumber: 'R70',
    operator: 'go-ahead',
    serviceDate: soonDepartureTime.toISOString().split('T')[0],
    fromStopPlaceId: 'NSR:StopPlace:41137', // Trondheim S
    toStopPlaceId: 'NSR:StopPlace:42607', // Stjørdal stasjon
    plannedDepartureUTC: admin.firestore.Timestamp.fromDate(soonDepartureTime),
    plannedArrivalUTC: admin.firestore.Timestamp.fromDate(soonArrivalTime),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const ref1 = await db.collection('journeyInstances').add(testJourney1);
    console.log(`[TestData] Created journey 1: ${ref1.id} (R70 Trondheim-Stjørdal, departing in 30 min)`);

    const ref2 = await db.collection('journeyInstances').add(testJourney2);
    console.log(`[TestData] Created journey 2: ${ref2.id} (R11 Oslo-Drammen, departed 8h ago - outside window)`);

    const ref3 = await db.collection('journeyInstances').add(testJourney3);
    console.log(`[TestData] Created journey 3: ${ref3.id} (R70 Trondheim-Stjørdal, departing in 5 min)`);

    console.log('[TestData] Test data created successfully!');
    console.log('\nTo verify:');
    console.log('1. Open Emulator UI: http://127.0.0.1:4000/firestore');
    console.log('2. Check journeyInstances collection');
    console.log('\nTo trigger delay check:');
    console.log('Use the functions emulator or call the function manually');

  } catch (error) {
    console.error('[TestData] Error creating test data:', error);
  } finally {
    process.exit(0);
  }
}

createTestJourneys();
