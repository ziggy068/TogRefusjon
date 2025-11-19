/**
 * Rule Engine Test Fixtures (TR-RU-501)
 *
 * Provides test data for manually testing the rule engine.
 * These can be used in debug UI or future automated tests.
 */

import { Timestamp } from 'firebase/firestore';
import { Ticket } from '../tickets/types';
import { DelayResult } from '../trainStatus/types';
import { JourneyInstance, CauseClassification } from '@/types/journey';

// Helper to create Firestore Timestamp from minutes offset
function timestampFromNow(minutesOffset: number): Timestamp {
  const date = new Date(Date.now() + minutesOffset * 60 * 1000);
  return Timestamp.fromDate(date);
}

/**
 * Base ticket template
 */
const baseTicket: Ticket = {
  userId: 'test-user-123',
  operator: 'Vy',
  trainNumber: 'R20',
  departureTime: new Date().toISOString(),
  fromStation: 'Oslo S',
  toStation: 'Trondheim S',
  priceNOK: 800,
  currency: 'NOK',
  source: 'manual',
  createdAt: new Date().toISOString(),
};

/**
 * Base journey instance template
 */
const baseJourney: JourneyInstance = {
  operator: 'Vy',
  trainNumber: 'R20',
  serviceDate: new Date().toISOString().split('T')[0],
  fromStopPlaceId: 'NSR:StopPlace:337', // Oslo S
  toStopPlaceId: 'NSR:StopPlace:41137', // Trondheim S
  plannedDepartureUTC: timestampFromNow(-120), // 2 hours ago
  plannedArrivalUTC: timestampFromNow(0), // now
  isCancelled: false,
  delayMinutesArrival: 0,
  rawDeviations: '[]',
  classifiedCause: CauseClassification.NORMAL_TECHNICAL,
  forceMajeureFlag: false,
  rulesSnapshotVersion: 'v1.0',
  evidenceSummary: '',
  enturRawJourneyStoragePath: '',
  createdAt: timestampFromNow(-180),
  updatedAt: timestampFromNow(-120),
  naturalKey: 'Vy:R20:2025-11-19:NSR:StopPlace:337:NSR:StopPlace:41137',
  matchingQuality: 'EXACT',
};

/**
 * Test Case 1: No delay (< 60 min)
 * Expected: NOT_ELIGIBLE, 0%
 */
export const testCase_NoDelay: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
} = {
  ticket: { ...baseTicket, id: 'ticket-no-delay' },
  journey: {
    ...baseJourney,
    delayMinutesArrival: 30,
    actualArrivalUTC: timestampFromNow(30),
  },
  delay: {
    journeyInstanceId: 'journey-no-delay',
    trainNumber: 'R20',
    operator: 'Vy',
    plannedArrivalTime: timestampFromNow(0).toDate().toISOString(),
    actualArrivalTime: timestampFromNow(30).toDate().toISOString(),
    arrivalDelayMinutes: 30,
    status: 'DELAYED',
    checkedAt: new Date().toISOString(),
    message: '30 minutes delay',
  },
};

/**
 * Test Case 2: Moderate delay (60-119 min)
 * Expected: ELIGIBLE, 25%
 */
export const testCase_ModerateDelay: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
} = {
  ticket: { ...baseTicket, id: 'ticket-moderate-delay', priceNOK: 1000 },
  journey: {
    ...baseJourney,
    delayMinutesArrival: 75,
    actualArrivalUTC: timestampFromNow(75),
  },
  delay: {
    journeyInstanceId: 'journey-moderate-delay',
    trainNumber: 'R20',
    operator: 'Vy',
    plannedArrivalTime: timestampFromNow(0).toDate().toISOString(),
    actualArrivalTime: timestampFromNow(75).toDate().toISOString(),
    arrivalDelayMinutes: 75,
    status: 'DELAYED',
    checkedAt: new Date().toISOString(),
    message: '75 minutes delay',
  },
};

/**
 * Test Case 3: High delay (>= 120 min)
 * Expected: ELIGIBLE, 50%
 */
export const testCase_HighDelay: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
} = {
  ticket: { ...baseTicket, id: 'ticket-high-delay', priceNOK: 1200 },
  journey: {
    ...baseJourney,
    delayMinutesArrival: 150,
    actualArrivalUTC: timestampFromNow(150),
  },
  delay: {
    journeyInstanceId: 'journey-high-delay',
    trainNumber: 'R20',
    operator: 'Vy',
    plannedArrivalTime: timestampFromNow(0).toDate().toISOString(),
    actualArrivalTime: timestampFromNow(150).toDate().toISOString(),
    arrivalDelayMinutes: 150,
    status: 'DELAYED',
    checkedAt: new Date().toISOString(),
    message: '150 minutes delay',
  },
};

/**
 * Test Case 4: Force majeure (no compensation)
 * Expected: NOT_ELIGIBLE, 0%
 */
export const testCase_ForceMajeure: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
} = {
  ticket: { ...baseTicket, id: 'ticket-force-majeure', priceNOK: 900 },
  journey: {
    ...baseJourney,
    delayMinutesArrival: 90,
    actualArrivalUTC: timestampFromNow(90),
    forceMajeureFlag: true,
    classifiedCause: CauseClassification.WEATHER_EXTREME,
  },
  delay: {
    journeyInstanceId: 'journey-force-majeure',
    trainNumber: 'R20',
    operator: 'Vy',
    plannedArrivalTime: timestampFromNow(0).toDate().toISOString(),
    actualArrivalTime: timestampFromNow(90).toDate().toISOString(),
    arrivalDelayMinutes: 90,
    status: 'DELAYED',
    checkedAt: new Date().toISOString(),
    message: '90 minutes delay due to extreme weather',
  },
};

/**
 * Test Case 5: Cancelled journey (no force majeure)
 * Expected: ELIGIBLE, 100% (TR-RU-503)
 */
export const testCase_Cancelled: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
} = {
  ticket: { ...baseTicket, id: 'ticket-cancelled', priceNOK: 1100 },
  journey: {
    ...baseJourney,
    isCancelled: true,
    delayMinutesArrival: 0,
  },
  delay: {
    journeyInstanceId: 'journey-cancelled',
    trainNumber: 'R20',
    operator: 'Vy',
    status: 'CANCELLED',
    checkedAt: new Date().toISOString(),
    message: 'Journey cancelled',
  },
};

/**
 * Test Case 6: Cancelled with force majeure
 * Expected: ELIGIBLE, 100% (TR-RU-503 - force majeure does NOT affect refund for cancelled journeys)
 */
export const testCase_CancelledForceMajeure: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
} = {
  ticket: { ...baseTicket, id: 'ticket-cancelled-fm', priceNOK: 950 },
  journey: {
    ...baseJourney,
    isCancelled: true,
    delayMinutesArrival: 0,
    forceMajeureFlag: true,
    classifiedCause: CauseClassification.STRIKE,
  },
  delay: {
    journeyInstanceId: 'journey-cancelled-fm',
    trainNumber: 'R20',
    operator: 'Vy',
    status: 'CANCELLED',
    checkedAt: new Date().toISOString(),
    message: 'Journey cancelled due to strike',
  },
};

/**
 * Test Case 7: Unknown delay
 * Expected: UNKNOWN, 0%
 */
export const testCase_Unknown: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
} = {
  ticket: { ...baseTicket, id: 'ticket-unknown', priceNOK: 850 },
  journey: { ...baseJourney, delayMinutesArrival: 0 },
  delay: {
    journeyInstanceId: 'journey-unknown',
    trainNumber: 'R20',
    operator: 'Vy',
    status: 'UNKNOWN',
    checkedAt: new Date().toISOString(),
    message: 'Could not determine delay status',
  },
};

/**
 * Test Case 8: Vy regional train 35 min delay (TR-RU-502)
 * EU: 0% (below 60 min threshold)
 * Operator: 50% (Vy gives 50% at 30 min)
 * Expected: 50% (operator wins)
 */
export const testCase_VyRegional35Min: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
} = {
  ticket: { ...baseTicket, id: 'ticket-vy-regional', operator: 'Vy', trainNumber: 'R10', priceNOK: 250 },
  journey: {
    ...baseJourney,
    operator: 'Vy',
    trainNumber: 'R10',
    delayMinutesArrival: 35,
    actualArrivalUTC: timestampFromNow(35),
  },
  delay: {
    journeyInstanceId: 'journey-vy-regional',
    trainNumber: 'R10',
    operator: 'Vy',
    plannedArrivalTime: timestampFromNow(0).toDate().toISOString(),
    actualArrivalTime: timestampFromNow(35).toDate().toISOString(),
    arrivalDelayMinutes: 35,
    status: 'DELAYED',
    checkedAt: new Date().toISOString(),
    message: '35 minutes delay on Vy regional train',
  },
};

/**
 * Test Case 9: Vy long-distance 70 min delay (TR-RU-502)
 * EU: 25% (60-119 min range)
 * Operator: 50% (Vy long-distance gives 50% at 60 min)
 * Expected: 50% (operator wins)
 */
export const testCase_VyLongDistance70Min: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
} = {
  ticket: { ...baseTicket, id: 'ticket-vy-ld', operator: 'Vy', trainNumber: 'F6', priceNOK: 900 },
  journey: {
    ...baseJourney,
    operator: 'Vy',
    trainNumber: 'F6',
    delayMinutesArrival: 70,
    actualArrivalUTC: timestampFromNow(70),
  },
  delay: {
    journeyInstanceId: 'journey-vy-ld',
    trainNumber: 'F6',
    operator: 'Vy',
    plannedArrivalTime: timestampFromNow(0).toDate().toISOString(),
    actualArrivalTime: timestampFromNow(70).toDate().toISOString(),
    arrivalDelayMinutes: 70,
    status: 'DELAYED',
    checkedAt: new Date().toISOString(),
    message: '70 minutes delay on Vy long-distance train',
  },
};

/**
 * Test Case 10: SJ Norge regional 35 min delay (TR-RU-502)
 * EU: 0% (below 60 min threshold)
 * Operator: 50% (SJ gives 50% at 30 min)
 * Expected: 50% (operator wins)
 */
export const testCase_SJRegional35Min: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
} = {
  ticket: { ...baseTicket, id: 'ticket-sj-regional', operator: 'SJ Norge', trainNumber: 'R11', priceNOK: 300 },
  journey: {
    ...baseJourney,
    operator: 'SJ Norge',
    trainNumber: 'R11',
    delayMinutesArrival: 35,
    actualArrivalUTC: timestampFromNow(35),
  },
  delay: {
    journeyInstanceId: 'journey-sj-regional',
    trainNumber: 'R11',
    operator: 'SJ Norge',
    plannedArrivalTime: timestampFromNow(0).toDate().toISOString(),
    actualArrivalTime: timestampFromNow(35).toDate().toISOString(),
    arrivalDelayMinutes: 35,
    status: 'DELAYED',
    checkedAt: new Date().toISOString(),
    message: '35 minutes delay on SJ regional train',
  },
};

/**
 * Test Case 11: Go-Ahead regional 35 min delay (TR-RU-502)
 * EU: 0% (below 60 min threshold)
 * Operator: 50% (Go-Ahead gives 50% at 30 min)
 * Expected: 50% (operator wins)
 */
export const testCase_GoAheadRegional35Min: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
} = {
  ticket: { ...baseTicket, id: 'ticket-goahead-regional', operator: 'Go-Ahead', trainNumber: 'R70', priceNOK: 280 },
  journey: {
    ...baseJourney,
    operator: 'Go-Ahead',
    trainNumber: 'R70',
    delayMinutesArrival: 35,
    actualArrivalUTC: timestampFromNow(35),
  },
  delay: {
    journeyInstanceId: 'journey-goahead-regional',
    trainNumber: 'R70',
    operator: 'Go-Ahead',
    plannedArrivalTime: timestampFromNow(0).toDate().toISOString(),
    actualArrivalTime: timestampFromNow(35).toDate().toISOString(),
    arrivalDelayMinutes: 35,
    status: 'DELAYED',
    checkedAt: new Date().toISOString(),
    message: '35 minutes delay on Go-Ahead regional train',
  },
};

/**
 * Test Case 12: Unknown operator 70 min delay (TR-RU-502)
 * EU: 25% (60-119 min range)
 * Operator: N/A (no override)
 * Expected: 25% (EU base rules)
 */
export const testCase_UnknownOp70Min: {
  ticket: Ticket;
  journey: JourneyInstance;
  delay: DelayResult;
} = {
  ticket: { ...baseTicket, id: 'ticket-unknown-op', operator: 'Unknown Railways', trainNumber: 'X99', priceNOK: 500 },
  journey: {
    ...baseJourney,
    operator: 'Unknown Railways',
    trainNumber: 'X99',
    delayMinutesArrival: 70,
    actualArrivalUTC: timestampFromNow(70),
  },
  delay: {
    journeyInstanceId: 'journey-unknown-op',
    trainNumber: 'X99',
    operator: 'Unknown Railways',
    plannedArrivalTime: timestampFromNow(0).toDate().toISOString(),
    actualArrivalTime: timestampFromNow(70).toDate().toISOString(),
    arrivalDelayMinutes: 70,
    status: 'DELAYED',
    checkedAt: new Date().toISOString(),
    message: '70 minutes delay on unknown operator',
  },
};

/**
 * All test cases (TR-RU-501 + TR-RU-502 + TR-RU-503)
 */
export const ALL_TEST_CASES = [
  // Base EU rules (TR-RU-501)
  { name: 'No delay (30 min)', ...testCase_NoDelay },
  { name: 'Moderate delay (75 min, 25%)', ...testCase_ModerateDelay },
  { name: 'High delay (150 min, 50%)', ...testCase_HighDelay },
  { name: 'Force majeure (90 min, no comp)', ...testCase_ForceMajeure },
  { name: 'Cancelled (100%)', ...testCase_Cancelled },
  { name: 'Cancelled + force majeure (100%)', ...testCase_CancelledForceMajeure },
  { name: 'Unknown delay', ...testCase_Unknown },

  // Operator overrides (TR-RU-502) - Norwegian operators
  { name: 'Vy regional 35 min (50% override)', ...testCase_VyRegional35Min },
  { name: 'Vy long-distance 70 min (50% override)', ...testCase_VyLongDistance70Min },
  { name: 'SJ regional 35 min (50% override)', ...testCase_SJRegional35Min },
  { name: 'Go-Ahead regional 35 min (50% override)', ...testCase_GoAheadRegional35Min },
  { name: 'Unknown operator 70 min (25% EU base)', ...testCase_UnknownOp70Min },
];

/**
 * Run manual tests (console logging)
 *
 * This function can be called from debug UI or browser console to verify rules.
 * It evaluates all test cases and logs the results.
 */
export function runManualTests() {
  console.log('=== Rule Engine Manual Tests ===\n');

  // Import is done dynamically to avoid circular dependencies
  import('./index').then(({ evaluateClaimWithAmount }) => {
    ALL_TEST_CASES.forEach((testCase, idx) => {
      console.log(`Test ${idx + 1}: ${testCase.name}`);

      const result = evaluateClaimWithAmount({
        ticket: testCase.ticket,
        journey: testCase.journey,
        delay: testCase.delay,
      });

      console.log(`  Status: ${result.status}`);
      console.log(`  Compensation: ${result.compensationPct}%`);
      console.log(`  Amount: ${result.compensationAmountNOK} NOK`);
      console.log(`  Reasons: ${result.reasons.join(' ')}`);
      console.log(`  Debug: ${JSON.stringify(result.debug)}\n`);
    });

    console.log('=== Tests Complete ===');
  });
}
