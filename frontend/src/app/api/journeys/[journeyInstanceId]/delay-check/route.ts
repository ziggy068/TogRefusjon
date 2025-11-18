/**
 * API Route: Delay Check (TR-TS-401)
 *
 * Endpoint for on-demand delay checking of train journeys.
 *
 * POST /api/journeys/[journeyInstanceId]/delay-check
 *
 * Fetches the journeyInstance from Firestore, queries Entur for current status,
 * calculates delay, and saves the result back to Firestore.
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { JourneyInstance } from '@/types/journey';
import { checkDelayForJourney } from '@/lib/trainStatus/delayCheck';
import { saveDelayResult } from '@/lib/trainStatus/firestore';

export async function POST(
  request: NextRequest,
  { params }: { params: { journeyInstanceId: string } }
) {
  try {
    const { journeyInstanceId } = params;

    console.log(`[API DelayCheck] Checking delay for journey: ${journeyInstanceId}`);

    // 1. Fetch journeyInstance from Firestore
    const journeyRef = doc(db, 'journeyInstances', journeyInstanceId);
    const journeySnap = await getDoc(journeyRef);

    if (!journeySnap.exists()) {
      return NextResponse.json(
        { error: 'JourneyInstance not found' },
        { status: 404 }
      );
    }

    const journey = journeySnap.data() as JourneyInstance;

    // 2. Extract parameters for delay check
    const checkParams = {
      journeyInstanceId,
      trainNumber: journey.trainNumber,
      operatorCode: journey.operator,
      plannedDepartureTime: journey.plannedDepartureUTC?.toDate().toISOString(),
      plannedArrivalTime: journey.plannedArrivalUTC?.toDate().toISOString(),
      serviceDate: journey.serviceDate,
      fromStopPlaceId: journey.fromStopPlaceId,
      toStopPlaceId: journey.toStopPlaceId,
    };

    // 3. Check delay via Entur
    const delayResult = await checkDelayForJourney(checkParams);

    console.log(`[API DelayCheck] Result: ${delayResult.status} - ${delayResult.message}`);

    // 4. Save result to Firestore
    await saveDelayResult(delayResult);

    console.log(`[API DelayCheck] Delay result saved to Firestore`);

    // 5. Return result
    return NextResponse.json({
      success: true,
      delayResult,
    });
  } catch (error: any) {
    console.error('[API DelayCheck] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
