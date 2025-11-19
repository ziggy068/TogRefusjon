'use client';

import { useState } from 'react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DelayResult } from '@/lib/trainStatus/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

/**
 * Delay Check Debug Page (TR-TS-401)
 *
 * Development tool for testing on-demand delay checking:
 * 1. List available journeyInstances
 * 2. Select one and trigger delay check
 * 3. Display the result
 *
 * This is a development-only tool (not for production).
 */
export default function DelayCheckDebugPage() {
  const [journeyInstanceId, setJourneyInstanceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingJourneys, setLoadingJourneys] = useState(false);
  const [result, setResult] = useState<{
    delayResult?: DelayResult;
    error?: string;
  } | null>(null);
  const [journeys, setJourneys] = useState<Array<{ id: string; data: any }>>([]);

  // Load recent journey instances for convenience
  const handleLoadJourneys = async () => {
    setLoadingJourneys(true);
    try {
      const journeysQuery = query(
        collection(db, 'journeyInstances'),
        limit(10)
      );
      const snapshot = await getDocs(journeysQuery);
      const journeyList = snapshot.docs.map((doc) => ({
        id: doc.id,
        data: doc.data(),
      }));
      setJourneys(journeyList);
    } catch (error: any) {
      console.error('Error loading journeys:', error);
    } finally {
      setLoadingJourneys(false);
    }
  };

  const handleCheckDelay = async () => {
    if (!journeyInstanceId.trim()) {
      setResult({ error: 'Vennligst fyll inn journeyInstanceId' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Call API route
      const response = await fetch(
        `/api/journeys/${journeyInstanceId}/delay-check`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setResult({ error: data.error || 'Unknown error' });
        return;
      }

      setResult({ delayResult: data.delayResult });
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-300 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            Forsinkelsessjekk (Debug)
          </h1>
          <p className="text-slate-600 mt-2">
            Test on-demand delay checking for train journeys (TR-TS-401)
          </p>
        </div>

        {/* Load recent journeys */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Siste journeyInstances
          </h2>
          <Button
            onClick={handleLoadJourneys}
            disabled={loadingJourneys}
            variant="secondary"
            size="sm"
            className="mb-4"
          >
            {loadingJourneys ? 'Laster...' : 'Last inn journeys'}
          </Button>

          {journeys.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {journeys.map((journey) => (
                <button
                  key={journey.id}
                  onClick={() => setJourneyInstanceId(journey.id)}
                  className="w-full text-left px-3 py-2 border border-slate-300 rounded hover:bg-slate-50 transition text-sm"
                >
                  <div className="font-mono text-xs text-slate-600 mb-1">
                    {journey.id}
                  </div>
                  <div className="font-medium">
                    {journey.data.trainNumber} - {journey.data.operator}
                  </div>
                  <div className="text-sm text-slate-600">
                    {journey.data.serviceDate}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Input form */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Sjekk forsinkelse
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                JourneyInstance ID
              </label>
              <input
                type="text"
                value={journeyInstanceId}
                onChange={(e) => setJourneyInstanceId(e.target.value)}
                placeholder="f.eks. abc123def456"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleCheckDelay}
              disabled={loading || !journeyInstanceId.trim()}
              className="w-full"
            >
              {loading ? 'Sjekker forsinkelse...' : 'Sjekk forsinkelse na'}
            </Button>
          </div>
        </Card>

        {/* Results */}
        {result && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Resultat
            </h2>

            {result.error && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                <p className="text-rose-900 font-medium">Feil</p>
                <p className="text-rose-700 text-sm mt-1">{result.error}</p>
              </div>
            )}

            {result.delayResult && (
              <div>
                {/* Status badge */}
                <div className="mb-4">
                  {result.delayResult.status === 'DELAYED' && (
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-rose-100 text-rose-900">
                      <span className="font-semibold">Forsinket</span>
                    </div>
                  )}
                  {result.delayResult.status === 'ON_TIME' && (
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-900">
                      <span className="font-semibold">I rute</span>
                    </div>
                  )}
                  {result.delayResult.status === 'CANCELLED' && (
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-900">
                      <span className="font-semibold">Kansellert</span>
                    </div>
                  )}
                  {result.delayResult.status === 'UNKNOWN' && (
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-900">
                      <span className="font-semibold">Ukjent</span>
                    </div>
                  )}
                </div>

                {/* Human-readable message */}
                {result.delayResult.message && (
                  <div className="mb-4">
                    <p className="text-lg font-medium text-slate-900">
                      {result.delayResult.message}
                    </p>
                  </div>
                )}

                {/* Delay details */}
                {(result.delayResult.departureDelayMinutes !== undefined ||
                  result.delayResult.arrivalDelayMinutes !== undefined) && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {result.delayResult.departureDelayMinutes !== undefined && (
                      <div>
                        <p className="text-sm text-slate-600">
                          Avgangsforsinkelse
                        </p>
                        <p className="text-2xl font-bold text-slate-900">
                          {result.delayResult.departureDelayMinutes} min
                        </p>
                      </div>
                    )}
                    {result.delayResult.arrivalDelayMinutes !== undefined && (
                      <div>
                        <p className="text-sm text-slate-600">
                          Ankomstforsinkelse
                        </p>
                        <p className="text-2xl font-bold text-slate-900">
                          {result.delayResult.arrivalDelayMinutes} min
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Full result as JSON */}
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-900 mb-2">
                    Full DelayResult (JSON):
                  </p>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs">
                    {JSON.stringify(result.delayResult, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
