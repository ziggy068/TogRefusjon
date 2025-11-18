/**
 * Train Status Firestore Helpers (TR-TS-401)
 *
 * Functions for storing delay check results in Firestore
 */

import {
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { DelayResult } from './types';

/**
 * Remove undefined values from object before writing to Firestore
 *
 * Firestore does not support undefined values. This helper strips them out.
 *
 * @param obj - Object that may contain undefined values
 * @returns Object with undefined values removed
 */
function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Save delay check result to Firestore (TR-TS-401)
 *
 * Stores the DelayResult as `lastDelayResult` field on the journeyInstance document.
 * This provides a simple way to track the most recent delay check for MVP.
 *
 * Future enhancement: Store in subcollection for full history tracking.
 *
 * @param result - DelayResult from checkDelayForJourney
 * @returns Promise that resolves when save is complete
 */
export async function saveDelayResult(result: DelayResult): Promise<void> {
  const { journeyInstanceId } = result;

  console.log(`[Firestore] Saving delay result for journey ${journeyInstanceId}`);

  try {
    const journeyRef = doc(db, 'journeyInstances', journeyInstanceId);

    // Clean the result to remove undefined values
    const cleanResult = removeUndefined(result);

    // Update journeyInstance with last delay check result
    await updateDoc(journeyRef, {
      lastDelayResult: cleanResult,
      lastDelayCheckAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log(`[Firestore] Delay result saved successfully`);
  } catch (error: any) {
    console.error('[Firestore] Error saving delay result:', error);
    throw new Error(`Could not save delay result: ${error.message}`);
  }
}

/**
 * Get last delay result for a journey instance
 *
 * @param journeyInstanceId - Journey instance document ID
 * @returns Last DelayResult or null if not found
 */
export async function getLastDelayResult(
  journeyInstanceId: string
): Promise<DelayResult | null> {
  try {
    const journeyRef = doc(db, 'journeyInstances', journeyInstanceId);
    const snapshot = await getDoc(journeyRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return data.lastDelayResult || null;
  } catch (error: any) {
    console.error('[Firestore] Error getting delay result:', error);
    return null;
  }
}
