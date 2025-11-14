export default function HjelpPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Hjelp & FAQ</h1>

      <div className="space-y-6">
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Hvordan fungerer Tog Refusjon?
          </h2>
          <ol className="list-decimal list-inside text-gray-700 space-y-2">
            <li>Last opp togbilletten din (PDF, bilde eller QR-kode)</li>
            <li>Vi normaliserer og lagrer reiseinformasjonen</li>
            <li>Systemet overvåker togstatusene dine automatisk</li>
            <li>Ved forsinkelse evalueres refusjonsreglene</li>
            <li>Refusjonskrav genereres automatisk</li>
            <li>Du godkjenner og sender kravet med ett klikk</li>
            <li>Vi følger opp status og varsler deg om svar</li>
          </ol>
        </section>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Hvilke tog dekkes?
          </h2>
          <p className="text-gray-700">
            For øyeblikket støtter vi norske togoperatører (Vy, Go-Ahead
            Nordic, SJ Norge). Andre operatører kan legges til i fremtiden.
          </p>
        </section>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Hvor lang forsinkelse kreves for refusjon?
          </h2>
          <p className="text-gray-700 mb-2">
            Reglene varierer per operatør, men typisk:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>20-59 minutter: 25% refusjon</li>
            <li>60-119 minutter: 50% refusjon</li>
            <li>120+ minutter: 100% refusjon</li>
          </ul>
          <p className="text-sm text-gray-600 mt-2">
            Sjekk operatørens vilkår for eksakte terskler.
          </p>
        </section>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Er tjenesten sikker?
          </h2>
          <p className="text-gray-700">
            Ja. Vi følger GDPR og bruker kryptering for alle sensitive data.
            Se vår <a href="/personvern" className="text-blue-600 hover:underline">personvernerklæring</a> for detaljer.
          </p>
        </section>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Hva koster tjenesten?
          </h2>
          <p className="text-gray-700">
            MVP-versjonen er gratis mens vi tester og forbedrer systemet.
            Prismodell vil bli kommunisert før eventuell kommersialisering.
          </p>
        </section>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Kontakt
          </h2>
          <p className="text-gray-700">
            Har du flere spørsmål? Send e-post til{" "}
            <a href="mailto:support@togrefusjon.no" className="text-blue-600 hover:underline">
              support@togrefusjon.no
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
