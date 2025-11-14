export default function StatusPage() {
  return (
    <div className="min-h-screen bg-slate-300">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Status & Krav</h1>
        <p className="mt-2 text-gray-600">
          Oversikt over togstatus og refusjonskrav
        </p>
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full">
            <span className="text-3xl">📊</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Ingen aktivitet ennå
          </h2>
          <p className="text-gray-600 max-w-md mx-auto">
            Når du har lastet opp billetter vil du se togstatus og
            refusjonskrav her.
          </p>
        </div>
      </div>

      {/* Status flow explanation */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl mb-2">⏳</div>
          <h3 className="font-semibold text-gray-900 text-sm">Observing</h3>
          <p className="text-xs text-gray-600 mt-1">
            Vi overvåker togstatusene dine
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl mb-2">🚨</div>
          <h3 className="font-semibold text-gray-900 text-sm">Delayed</h3>
          <p className="text-xs text-gray-600 mt-1">
            Forsinkelse oppdaget, evaluerer regler
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl mb-2">📝</div>
          <h3 className="font-semibold text-gray-900 text-sm">Draft</h3>
          <p className="text-xs text-gray-600 mt-1">
            Refusjonskrav generert, venter på godkjenning
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl mb-2">✅</div>
          <h3 className="font-semibold text-gray-900 text-sm">Submitted</h3>
          <p className="text-xs text-gray-600 mt-1">
            Sendt til operatør, venter på svar
          </p>
        </div>
      </div>

      {/* Coming soon from TR-TS-401, TR-RU-501, TR-CL-601 */}
      </div>
    </div>
  );
}
