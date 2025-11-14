export default function PersonvernPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Personvernerklæring
      </h1>

      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            1. Innledning
          </h2>
          <p className="text-gray-700">
            Tog Refusjon tar personvern på alvor. Denne erklæringen beskriver
            hvordan vi samler inn, bruker og beskytter dine personopplysninger.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            2. Hvilke data vi samler
          </h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>E-postadresse (autentisering)</li>
            <li>Togbilletter (PDF, bilder eller QR-koder)</li>
            <li>Reiseinformasjon (strekninger, datoer)</li>
            <li>Forsinkelsesdata fra offentlige API-er</li>
            <li>Genererte refusjonskrav og status</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            3. Hvordan vi beskytter data
          </h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>
              <strong>Kryptering:</strong> PII lagres i kryptert bucket med KMS
            </li>
            <li>
              <strong>Minimering:</strong> Kun nødvendige referanser i Firestore
            </li>
            <li>
              <strong>Tilgangskontroll:</strong> Firestore-regler sikrer at
              brukere kun ser egne data
            </li>
            <li>
              <strong>Audit logs:</strong> Ingen PII i logger/metrikker
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            4. Datalagringstid
          </h2>
          <p className="text-gray-700">
            Data slettes automatisk 12 måneder etter at refusjonskravet er
            lukket, i henhold til GDPR.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            5. Dine rettigheter
          </h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Innsyn i dine data</li>
            <li>Retting av uriktige data</li>
            <li>Sletting av data (rett til å bli glemt)</li>
            <li>Eksport av data (dataportabilitet)</li>
          </ul>
        </section>

        <section className="mb-8">
          <p className="text-sm text-gray-600">
            Sist oppdatert: {new Date().toLocaleDateString("no-NO")}
          </p>
        </section>
      </div>
    </div>
  );
}
