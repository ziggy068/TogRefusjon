'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Remove undefined values from object before writing to Firestore
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
 * Journey Test Page
 *
 * Debug tool for testing the full journey → claim workflow:
 * 1. Create a test ticket
 * 2. Call createClaimForTicket
 * 3. Display journeyInstance and claim data
 *
 * This is a development-only tool (not for production).
 */
export default function JourneyTestPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ticketId?: string;
    claimId?: string;
    journeyInstance?: unknown;
    claim?: unknown;
    error?: string;
  } | null>(null);

  const handleCreateTestClaim = async () => {
    if (!user) {
      setResult({ error: 'You must be logged in to test' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // 1. Create a test ticket (hardcoded for Oslo S → Bergen)
      // NOTE: Date is hardcoded for DEV testing. Entur returns real-time data
      // regardless of date, so this will match against current departures.
      const testTicket = {
        userId: user.uid,
        date: new Date().toISOString().split('T')[0], // Use today's date
        time: '08:25', // Approximate time for matching
        trainNo: '601', // Vy train Oslo-Bergen (Bergensbanen)
        operator: 'Vy',
        from: 'Oslo S',
        to: 'Bergen stasjon',
        
        description: 'Test ticket for journey-test debug page',
        source: 'manual' as const,
        status: 'validated' as const,
        importedAt: Timestamp.now(),
        claimStatus: 'none' as const,
      };

      const ticketRef = await addDoc(
        collection(db, 'users', user.uid, 'tickets'),
        removeUndefined(testTicket)
      );

      // 2. Call API route to create claim
      // (We use an API route because Entur queries should run server-side)
      const response = await fetch('/api/debug/create-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          ticketId: ticketRef.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create claim');
      }

      const data = await response.json();

      setResult({
        ticketId: ticketRef.id,
        claimId: data.claimId,
        journeyInstance: data.journeyInstance,
        claim: data.claim,
      });
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-300 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Journey Test Debug Tool</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Workflow</h2>
          <p className="text-gray-600 mb-4">
            This tool creates a test ticket (Oslo S → Bergen stasjon, train 601)
            and generates a claim with real Entur data.
          </p>

          {!user ? (
            <p className="text-red-600">You must be logged in to use this tool.</p>
          ) : (
            <button
              onClick={handleCreateTestClaim}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Test Claim'}
            </button>
          )}
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Result</h2>

            {result.error ? (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <strong>Error:</strong> {result.error}
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer">Technical details</summary>
                  <pre className="mt-2 bg-red-50 p-2 rounded overflow-auto max-h-48">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-green-600">✓ Success</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Ticket ID:</strong> {result.ticketId}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Claim ID:</strong> {result.claimId}
                  </p>
                </div>

                {result.journeyInstance && (
                  <div>
                    <h3 className="font-semibold mb-2">Journey Instance:</h3>
                    <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-64">
                      {JSON.stringify(result.journeyInstance, null, 2)}
                    </pre>
                  </div>
                )}

                {result.claim && (
                  <div>
                    <h3 className="font-semibold mb-2">Claim:</h3>
                    <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-64">
                      {JSON.stringify(result.claim, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
