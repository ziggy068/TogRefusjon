#role
Du er senior systemutvikler og “dokument-ingeniør” i TogRefusjon-prosjektet.
Du skal bygge første versjon av en kravbrev-generator som bruker:
- claim-dokumentet (inkl. rule engine-resultat)
- journeyEvidenceSnapshot
- billett-data
- brukerprofil
for å lage en strukturert modell for selve kravbrevet.

#task
Bygg en enkel, men strukturert løsning for kravbrev (“claim letter”) som:

1. Definerer en egen TypeScript-modell for brevinnholdet (ikke PDF, kun data/tekst).
2. Har en helper-funksjon som bygger et brev-objekt fra:
   - Claim
   - JourneyEvidenceSnapshot
   - Ticket
   - User profile
3. Har en enkel debug-view (side/route) som viser hvordan brevet ser ut i ren tekst/HTML.

Dette skal være MVP, men seriøst nok til å kunne sendes til togselskap etter litt finpuss.

#specifics

1. Les først:
   - `frontend/src/types/journey.ts` (Claim, JourneyInstance, evt. JourneyEvidence-typer)
   - `frontend/src/lib/evidence.ts` (hvis eksisterer)
   - `frontend/src/lib/claims.ts`
   - `frontend/src/lib/journeyInstances.ts`
   - `frontend/src/app/api/debug/create-claim/route.ts`
   - `frontend/src/app/debug/journey-test/page.tsx`
   - Evt. user-/profile-typer (hvordan vi lagrer navn, epost, osv.)

2. Definer brevmodell (TypeScript)
   - Opprett ny fil: `frontend/src/types/claimLetter.ts`
   - Definer f.eks.:
     - `ClaimLetterParty` – info om part (navn, adresse, epost, telefon).
     - `ClaimLetterJourneyInfo` – nøkkelfakta om reisen:
       - dato, tognummer, strekning (fra/til med både navn og NSR-id)
       - planlagt/forventet ankomst
       - faktisk forsinkelse i minutter
       - ev. info om kansellering
     - `ClaimLetterLegalSection` – hvilke regler vi viser til (tekst + refs).
     - `ClaimLetterCompensation` – beløp, prosent, billettpris.
     - `ClaimLetterModel` – hovedobjekt, f.eks.:
       - `from` (passasjer)
       - `to` (operatør – kan være placeholder nå)
       - `journey`
       - `legal`
       - `compensation`
       - `metadata` (claimId, journeyInstanceId, ruleVersionAtDecision, generatedAt)
       - `bodyParagraphs: string[]` (tekstblokker i anbefalt rekkefølge)

3. Implementer builder-funksjon
   - Opprett fil: `frontend/src/lib/claimLetter.ts`
   - Implementer f.eks.:
     - `buildClaimLetterModel(params: { claim: Claim; evidence: JourneyEvidence; ticket: Ticket; userProfile: UserProfile }): ClaimLetterModel`
   - Denne skal:
     - Fylle inn:
       - `from`: navn + evt. epost fra brukerprofil.
       - `to`: legg inn en enkel placeholder som “Vy Kundeservice” eller basert på `operator` (operatør-spesifikt oppsett kan komme senere).
       - `journey`: basert på `journeyEvidenceSnapshot.journeyInstanceRef` + `timing`.
       - `compensation`: bruk `ticketPriceNOK`, `calculatedCompensationPct`, `calculatedCompensationAmountNOK`.
       - `legal`: basert på `legalBasisRefs` og `ruleVersionAtDecision` / `rulesSnapshotVersion`.
     - Generere `bodyParagraphs` med enkel norsk tekst, f.eks.:
       1. Innledning (“Jeg fremmer herved krav om kompensasjon for forsinket togreise ...”)
       2. Fakta om reisen (dato, tognummer, fra/til, forsinkelse)
       3. Rettslig grunnlag (henvis til EU-forordning + norsk forskrift + operatørvilkår – basert på `legalBasisRefs`)
       4. Konklusjon/krav (beløp og hvordan det er beregnet)
       5. Avslutning (kontonummer/utbetalingsinfo kan være TODO/placeholder)

   - Viktig:
     - Kommenter tydelig at dette er første versjon, og at språk/ordlyd skal skjerpes senere i samråd med juridisk/brukeropplevelse.
     - Ikke hardkod altfor mye – bruk feltene fra claim/evidence så godt som mulig.

4. Debug API/side for brevvisning
   - Lag en ny debug-side, f.eks.:
     - `frontend/src/app/debug/claim-letter/page.tsx`
   - Funksjon:
     - La brukeren:
       - Velge en eksisterende claim (f.eks. ved å skrive inn claimId, eller ved å bruke den siste claim-en for innlogget bruker).
       - Hente claim + tilhørende journeyInstance/evidence + ticket + brukerprofil fra Firestore.
       - Kalle `buildClaimLetterModel(...)`.
     - Vis resultatet i to formater:
       1. JSON-visning (for utviklere):
          - `<pre>{JSON.stringify(letterModel, null, 2)}</pre>`
       2. Enkel “brev-rendering”:
          - Render `bodyParagraphs` som `<p>`-blokker i riktig rekkefølge
          - Vis “fra/til”-informasjon og nøkkeldata om reisen i toppen.

   - Alternativ: lag heller en API-route under `/api/debug/claim-letter` som tar `claimId` og returnerer `ClaimLetterModel` – og la debug-siden bare kalle denne. Velg det som passer best inn i eksisterende struktur.

5. Forutsetninger og antagelser
   - Hvis `ticketPriceNOK` mangler, bruk fallback (500 NOK) men kommenter det tydelig.
   - Hvis `delayMinutesArrival` mangler, behandle det som 0 og marker i `summary`/tekst at forsinkelsen ikke kunne fastslås sikkert.
   - Hvis `legalBasisRefs` er tom, bruk en standard-liste (f.eks. EU + norsk forskrift + operatørvilkår-placeholder) – kommenter at dette er midlertidig.

6. Ingen undefined til Firestore
   - ClaimLetterModel skal **ikke** lagres i Firestore i denne oppgaven.
   - Det er nok at den kan genereres on the fly og vises via debug-siden/route.
   - Pass på fortsatt å ikke sende `undefined` til Firestore hvis du gjør noen tilleggs-reads/writes i denne oppgaven.

#context
- Prosjekt: TogRefusjon (Next.js 14, TypeScript, Firebase/Firestore).
- Vi har nå claim-dokumenter med:
  - `ticketPriceNOK`
  - `calculatedCompensationPct`
  - `calculatedCompensationAmountNOK`
  - `ruleVersionAtDecision = "v1.0-delay-only-mvp"`
  - `legalBasisRefs` som f.eks.:
    - `"EU_2021_782_art19"`
    - `"NO_jernbane_forskrift_2023"`
    - `"Vy_passasjervilkår_placeholder"`
  - `journeyEvidenceSnapshot` med:
    - `journeyInstanceRef` (tognummer, dato, strekning)
    - `timing.delayMinutesArrival`
    - `cause`
    - `entur`
    - `rules.rulesSnapshotVersion`
    - `summary`

- Målet nå er å binde dette sammen i et strukturert “brevmodell”-lag som senere kan brukes til:
  - generering av PDF
  - e-post
  - eller ren tekst-eksport.

#examples
Gi resultatet som:
1. Kort forklaring (maks 10 linjer) på hva du har gjort.
2. Nye/oppdaterte filer:
   - `frontend/src/types/claimLetter.ts`
   - `frontend/src/lib/claimLetter.ts`
   - `frontend/src/app/debug/claim-letter/page.tsx` (eller tilsvarende API-route + enkel debug-side)
3. En liten manuell testoppskrift, f.eks.:
   - `npm run dev`
   - gå til `/debug/journey-test` og lag en claim
   - gå til `/debug/claim-letter`
   - hent samme claimId
   - se at ClaimLetterModel + renderet brev vises og at innholdet stemmer med claim/evidence.

#notes
- Språket i brev-tekstene kan være enkelt/nøkternt nå – vi kan senere finpusse ordlyd med fokus på brukeropplevelse og juridisk presisjon.
- Ikke skriv faktisk PDF-generering i denne oppgaven – det kommer som egen oppgave.
- Husk å holde alt typesikkert (TypeScript), og unngå `any` så langt som mulig.
