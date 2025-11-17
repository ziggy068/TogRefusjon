/**
 * Debug API Route: Create Claim
 *
 * This is a development-only endpoint for testing the claim creation workflow.
 * In production, claim creation would be triggered by user actions in the UI
 * or scheduled Cloud Functions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClaimForTicket } from '@/lib/claims';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ticketId } = body;

    if (!userId || !ticketId) {
      return NextResponse.json(
        { error: 'userId and ticketId are required' },
        { status: 400 }
      );
    }

    console.log(`[API] Creating claim for user=${userId}, ticket=${ticketId}`);

    // Create claim
    const claimId = await createClaimForTicket(userId, ticketId);

    console.log(`[API] Claim created: ${claimId}`);

    // Fetch created claim and journeyInstance for debugging
    const claimRef = doc(db, 'claims', claimId);
    const claimSnap = await getDoc(claimRef);
    const claim = claimSnap.data();

    let journeyInstance = null;
    if (claim?.journeyInstanceId) {
      const journeyRef = doc(db, 'journeyInstances', claim.journeyInstanceId);
      const journeySnap = await getDoc(journeyRef);
      journeyInstance = journeySnap.data();
      console.log(
        `[API] JourneyInstance: ${claim.journeyInstanceId} (delay: ${journeyInstance?.delayMinutesArrival}min)`
      );
    }

    return NextResponse.json({
      claimId,
      claim,
      journeyInstance,
    });
  } catch (error) {
    console.error('[API] Error creating claim:', error);

    // Return detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorStack,
        hint: 'Check server console for more details',
      },
      { status: 500 }
    );
  }
}
