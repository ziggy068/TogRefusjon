'use client';

/**
 * Debug Page: Claim Letter Preview
 *
 * This page allows developers to:
 * 1. Enter a claim ID
 * 2. Fetch claim + journeyInstance + evidence + ticket + user profile
 * 3. Generate ClaimLetterModel using buildClaimLetterModel()
 * 4. View the result in two formats:
 *    - JSON (for developers)
 *    - Formatted letter (HTML preview)
 */

import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Claim } from '@/types/journey';
import { JourneyEvidence } from '@/lib/evidence';
import { Ticket } from '@/lib/journeyInstances';
import {
  buildClaimLetterModel,
  UserProfile,
  BuildClaimLetterParams,
} from '@/lib/claimLetter';
import { ClaimLetterModel } from '@/types/claimLetter';

export default function ClaimLetterDebugPage() {
  const [claimId, setClaimId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [letterModel, setLetterModel] = useState<ClaimLetterModel | null>(null);
  const [viewMode, setViewMode] = useState<'json' | 'letter'>('letter');

  /**
   * Fetch claim and build letter model
   */
  const handleFetchAndBuild = async () => {
    if (!claimId.trim()) {
      setError('Please enter a claim ID');
      return;
    }

    setLoading(true);
    setError(null);
    setLetterModel(null);

    try {
      // 1. Fetch claim document
      console.log(`[ClaimLetter] Fetching claim: ${claimId}`);
      const claimRef = doc(db, 'claims', claimId);
      const claimSnap = await getDoc(claimRef);

      if (!claimSnap.exists()) {
        throw new Error(`Claim not found: ${claimId}`);
      }

      const claim = claimSnap.data() as Claim;
      console.log(`[ClaimLetter] Claim fetched:`, claim);

      // 2. Extract evidence snapshot from claim
      // NOTE: Evidence is already snapshotted into claim document at creation time
      if (!claim.journeyEvidenceSnapshot) {
        throw new Error(
          `Claim ${claimId} has no journeyEvidenceSnapshot. This should not happen.`
        );
      }

      const evidence = claim.journeyEvidenceSnapshot as unknown as JourneyEvidence;
      console.log(`[ClaimLetter] Evidence extracted from claim:`, evidence);

      // Convert Firestore Timestamp-like objects back to Dates
      // (Firestore serializes Timestamps to {seconds, nanoseconds} when read)
      const evidenceWithDates: JourneyEvidence = {
        ...evidence,
        timing: {
          ...evidence.timing,
          plannedDeparture: new Date(evidence.timing.plannedDeparture as any),
          plannedArrival: new Date(evidence.timing.plannedArrival as any),
          actualDeparture: evidence.timing.actualDeparture
            ? new Date(evidence.timing.actualDeparture as any)
            : undefined,
          actualArrival: evidence.timing.actualArrival
            ? new Date(evidence.timing.actualArrival as any)
            : undefined,
          expectedArrival: evidence.timing.expectedArrival
            ? new Date(evidence.timing.expectedArrival as any)
            : undefined,
        },
        entur: {
          ...evidence.entur,
          fetchedAt: new Date(evidence.entur.fetchedAt as any),
        },
        generatedAt: new Date(evidence.generatedAt as any),
      };

      // 3. Fetch ticket
      console.log(`[ClaimLetter] Fetching ticket: ${claim.ticketId}`);
      const ticketRef = doc(
        db,
        'users',
        claim.userId,
        'tickets',
        claim.ticketId
      );
      const ticketSnap = await getDoc(ticketRef);

      if (!ticketSnap.exists()) {
        throw new Error(`Ticket not found: ${claim.ticketId}`);
      }

      const ticket = ticketSnap.data() as Ticket;
      console.log(`[ClaimLetter] Ticket fetched:`, ticket);

      // 4. Fetch user profile
      console.log(`[ClaimLetter] Fetching user profile: ${claim.userId}`);
      const userRef = doc(db, 'users', claim.userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error(`User profile not found: ${claim.userId}`);
      }

      const userProfile = userSnap.data() as UserProfile;
      console.log(`[ClaimLetter] User profile fetched:`, userProfile);

      // 5. Build claim letter model
      console.log(`[ClaimLetter] Building claim letter model...`);
      const params: BuildClaimLetterParams = {
        claim,
        evidence: evidenceWithDates,
        ticket,
        userProfile,
      };

      const model = buildClaimLetterModel(params);
      console.log(`[ClaimLetter] Letter model built:`, model);

      setLetterModel(model);
    } catch (err: any) {
      console.error('[ClaimLetter] Error:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Claim Letter Preview (Debug)
          </h1>
          <p className="text-gray-600">
            Generate and preview claim letters from existing claims.
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={claimId}
              onChange={(e) => setClaimId(e.target.value)}
              placeholder="Enter claim ID"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleFetchAndBuild}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Generate Letter'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        {letterModel && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setViewMode('letter')}
                className={`px-4 py-2 rounded-lg ${
                  viewMode === 'letter'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Letter View
              </button>
              <button
                onClick={() => setViewMode('json')}
                className={`px-4 py-2 rounded-lg ${
                  viewMode === 'json'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                JSON View
              </button>
            </div>

            {/* Letter View */}
            {viewMode === 'letter' && (
              <div className="prose max-w-none">
                <LetterView model={letterModel} />
              </div>
            )}

            {/* JSON View */}
            {viewMode === 'json' && (
              <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(letterModel, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="font-bold text-blue-900 mb-2">How to use:</h2>
          <ol className="list-decimal list-inside text-blue-800 space-y-1">
            <li>Go to /debug/journey-test and create a test claim</li>
            <li>Copy the claim ID from the console or Firestore</li>
            <li>Paste the claim ID above and click "Generate Letter"</li>
            <li>View the letter in formatted view or JSON view</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

/**
 * Letter View Component
 *
 * Renders the claim letter in a human-readable format (similar to how it would
 * appear in a printed/PDF letter).
 */
function LetterView({ model }: { model: ClaimLetterModel }) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8 font-serif">
      {/* Sender (top right) */}
      <div className="text-right mb-8">
        <p className="font-semibold">{model.from.name}</p>
        {model.from.email && <p className="text-sm">{model.from.email}</p>}
        {model.from.address && <p className="text-sm">{model.from.address}</p>}
        {model.from.phone && <p className="text-sm">{model.from.phone}</p>}
      </div>

      {/* Recipient */}
      <div className="mb-8">
        <p className="font-semibold">{model.to.name}</p>
        {model.to.address && <p className="text-sm">{model.to.address}</p>}
        {model.to.email && <p className="text-sm">{model.to.email}</p>}
      </div>

      {/* Date */}
      <div className="mb-8 text-right text-sm text-gray-600">
        {new Date(model.metadata.generatedAt).toLocaleDateString('no-NO', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </div>

      {/* Subject */}
      <div className="mb-8">
        <p className="font-bold text-lg">{model.subject}</p>
      </div>

      {/* Body paragraphs */}
      <div className="space-y-4">
        {model.bodyParagraphs.map((paragraph, index) => (
          <p key={index} className="text-justify leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Metadata (debug info) */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-500">
        <p>Claim ID: {model.metadata.claimId}</p>
        <p>Journey Instance ID: {model.metadata.journeyInstanceId}</p>
        <p>Rule Version: {model.metadata.ruleVersionAtDecision}</p>
        <p>
          Generated:{' '}
          {new Date(model.metadata.generatedAt).toLocaleString('no-NO')}
        </p>
      </div>
    </div>
  );
}
