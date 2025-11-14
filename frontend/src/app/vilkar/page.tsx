export default function VilkarPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Vilkår for bruk
      </h1>

      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            1. Aksept av vilkår
          </h2>
          <p className="text-gray-700">
            Ved å bruke Tog Refusjon aksepterer du disse vilkårene. Les dem
            nøye før du tar i bruk tjenesten.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            2. Tjenestebeskrivelse
          </h2>
          <p className="text-gray-700">
            Tog Refusjon er en automatisert tjeneste som hjelper deg med å
            kreve refusjon ved togforsinkelser. Vi overvåker togstatus,
            evaluerer refusjonskrav og genererer dokumentasjon på dine vegne.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            3. Brukerens ansvar
          </h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Du må oppgi korrekt informasjon</li>
            <li>Du er ansvarlig for å holde kontoen din sikker</li>
            <li>Du må godkjenne refusjonskrav før innsending</li>
            <li>Du må ikke misbruke tjenesten</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            4. Garantier og ansvarsbegrensning
          </h2>
          <p className="text-gray-700">
            Tjenesten leveres "som den er". Vi kan ikke garantere at alle
            refusjonskrav blir godkjent av operatørene. Vi er ikke ansvarlige
            for tap som følge av bruk av tjenesten.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            5. Endringer i vilkår
          </h2>
          <p className="text-gray-700">
            Vi forbeholder oss retten til å endre disse vilkårene. Du vil bli
            varslet om vesentlige endringer.
          </p>
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
