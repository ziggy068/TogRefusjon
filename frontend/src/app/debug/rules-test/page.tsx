'use client';

/**
 * Rule Engine Test Page (TR-RU-501)
 *
 * Debug page for testing the compensation rule engine.
 * Allows manual testing of different delay scenarios.
 */

import { useState } from 'react';
import {
  evaluateClaimWithAmount,
  RuleOutcome,
} from '@/lib/rules';
import {
  ALL_TEST_CASES,
  runManualTests,
} from '@/lib/rules/fixtures';

export default function RulesTestPage() {
  const [selectedTestIndex, setSelectedTestIndex] = useState<number>(0);
  const [result, setResult] = useState<
    (RuleOutcome & { compensationAmountNOK: number }) | null
  >(null);

  const selectedTest = ALL_TEST_CASES[selectedTestIndex];

  const handleEvaluate = () => {
    if (!selectedTest) return;

    const outcome = evaluateClaimWithAmount({
      ticket: selectedTest.ticket,
      journey: selectedTest.journey,
      delay: selectedTest.delay,
    });

    setResult(outcome);
  };

  const handleRunAllTests = () => {
    runManualTests();
    alert('Se konsollen for test-resultater');
  };

  return (
    <div className="min-h-screen bg-slate-300 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Regelmotor Test</h1>
        <p className="text-gray-600 mb-6">
          Test kompensasjon-regelmotoren med forskjellige forsinkelse-scenarier
        </p>

        {/* Test Case Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Velg test-case</h2>

          <div className="space-y-2 mb-4">
            {ALL_TEST_CASES.map((testCase, idx) => (
              <label
                key={idx}
                className="flex items-center p-3 border rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="radio"
                  name="testCase"
                  checked={selectedTestIndex === idx}
                  onChange={() => setSelectedTestIndex(idx)}
                  className="mr-3"
                />
                <span className="font-medium">{testCase.name}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleEvaluate}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Evaluer krav
            </button>

            <button
              onClick={handleRunAllTests}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 font-medium"
            >
              Kjør alle tester (konsoll)
            </button>
          </div>
        </div>

        {/* Selected Test Details */}
        {selectedTest && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Test-detaljer</h2>

            <div className="grid grid-cols-2 gap-6">
              {/* Ticket Info */}
              <div>
                <h3 className="font-semibold mb-2 text-gray-700">Billett</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Operatør:</span>{' '}
                    {selectedTest.ticket.operator}
                  </p>
                  <p>
                    <span className="font-medium">Tog:</span>{' '}
                    {selectedTest.ticket.trainNumber}
                  </p>
                  <p>
                    <span className="font-medium">Fra:</span>{' '}
                    {selectedTest.ticket.fromStation}
                  </p>
                  <p>
                    <span className="font-medium">Til:</span>{' '}
                    {selectedTest.ticket.toStation}
                  </p>
                  <p>
                    <span className="font-medium">Pris:</span>{' '}
                    {selectedTest.ticket.priceNOK} kr
                  </p>
                </div>
              </div>

              {/* Delay Info */}
              <div>
                <h3 className="font-semibold mb-2 text-gray-700">Forsinkelse</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Status:</span>{' '}
                    <span
                      className={
                        selectedTest.delay.status === 'ON_TIME'
                          ? 'text-green-600'
                          : selectedTest.delay.status === 'DELAYED'
                            ? 'text-orange-600'
                            : selectedTest.delay.status === 'CANCELLED'
                              ? 'text-red-600'
                              : 'text-gray-600'
                      }
                    >
                      {selectedTest.delay.status}
                    </span>
                  </p>
                  {selectedTest.delay.arrivalDelayMinutes !== undefined && (
                    <p>
                      <span className="font-medium">Forsinkelse:</span>{' '}
                      {selectedTest.delay.arrivalDelayMinutes} min
                    </p>
                  )}
                  {selectedTest.delay.departureDelayMinutes !== undefined && (
                    <p>
                      <span className="font-medium">Avgang forsinkelse:</span>{' '}
                      {selectedTest.delay.departureDelayMinutes} min
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Force majeure:</span>{' '}
                    {selectedTest.journey.forceMajeureFlag ? 'Ja' : 'Nei'}
                  </p>
                  {selectedTest.delay.message && (
                    <p>
                      <span className="font-medium">Melding:</span>{' '}
                      {selectedTest.delay.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Evaluation Result */}
        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Evalueringsresultat</h2>

            {/* Status Badge */}
            <div className="mb-4">
              <span
                className={`inline-block px-4 py-2 rounded-lg font-semibold text-white ${
                  result.status === 'ELIGIBLE'
                    ? 'bg-green-600'
                    : result.status === 'NOT_ELIGIBLE'
                      ? 'bg-red-600'
                      : 'bg-gray-600'
                }`}
              >
                {result.status === 'ELIGIBLE'
                  ? 'BERETTIGET'
                  : result.status === 'NOT_ELIGIBLE'
                    ? 'IKKE BERETTIGET'
                    : 'UKJENT'}
              </span>
            </div>

            {/* Compensation Details */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Kompensasjon</p>
                <p className="text-3xl font-bold text-blue-600">
                  {result.compensationPct}%
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Beløp</p>
                <p className="text-3xl font-bold text-green-600">
                  {result.compensationAmountNOK} kr
                </p>
              </div>
            </div>

            {/* Reasons */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2 text-gray-700">Begrunnelse</h3>
              <div className="bg-gray-50 p-4 rounded">
                <ul className="list-disc list-inside space-y-1">
                  {result.reasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Legal Basis */}
            {result.legalBasis.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2 text-gray-700">
                  Lovgrunnlag
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.legalBasis.map((basis, idx) => (
                    <span
                      key={idx}
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm"
                    >
                      {basis}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Debug Info */}
            {result.debug && (
              <div>
                <h3 className="font-semibold mb-2 text-gray-700">Debug</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">
                  {JSON.stringify(result.debug, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
