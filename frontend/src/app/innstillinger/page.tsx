"use client";

export default function InnstillingerPage() {
  return (
    <div className="min-h-screen bg-slate-300">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Innstillinger</h1>
          <p className="mt-2 text-slate-600">
            Administrer profil, varsler og personvern
          </p>
        </div>

      {/* Profile section */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Profil</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              E-post
            </label>
            <div className="text-slate-900">bruker@eksempel.no</div>
            <p className="text-xs text-slate-500 mt-1">
              Autentisering via Firebase Auth (TR-AU-201)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Navn
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Ola Nordmann"
              disabled
            />
            <p className="text-xs text-slate-500 mt-1">
              Kommer i TR-AU-201 (profil)
            </p>
          </div>
        </div>
        </div>

      {/* Notifications section */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Varsler</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-900">
                E-postvarsler
              </div>
              <p className="text-xs text-slate-500">
                Få beskjed om togforsinkelser og kravstatus
              </p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 text-primary-500 rounded focus:ring-primary-500"
              disabled
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-900">
                Push-varsler
              </div>
              <p className="text-xs text-slate-500">
                Sanntidsvarsler på mobil (PWA)
              </p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 text-primary-500 rounded focus:ring-primary-500"
              disabled
            />
          </div>
          <p className="text-xs text-slate-500">Kommer i TR-NFY-701 (M8)</p>
        </div>
        </div>

      {/* Privacy section */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
            Personvern & Data
          </h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <p className="text-sm text-slate-700 mb-2">
              Dine togbilletter og personlige opplysninger lagres kryptert i
              henhold til GDPR.
            </p>
            <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
              <li>PII lagres i kryptert bucket med KMS</li>
              <li>Kun referanser i Firestore</li>
              <li>Automatisk sletting etter 12 måneder</li>
              <li>Ingen PII i audit logs</li>
            </ul>
          </div>
          <button className="text-sm text-rose-600 hover:text-rose-700 font-medium">
            Slett alle mine data
          </button>
          <p className="text-xs text-slate-500">
            GDPR-sletting i TR-GDPR-703 (M8)
          </p>
        </div>
        </div>

        {/* Danger zone */}
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-rose-900 mb-2">
            ⚠️ Slett konto
          </h3>
          <p className="text-sm text-rose-800 mb-4">
            Dette vil permanent slette din konto og alle tilknyttede data. Denne
            handlingen kan ikke angres.
          </p>
          <button className="px-6 py-3 bg-rose-600 text-white rounded-full text-sm font-semibold hover:bg-rose-700 transition-colors duration-200 shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">
            Slett konto permanent
          </button>
        </div>
      </div>
    </div>
  );
}
