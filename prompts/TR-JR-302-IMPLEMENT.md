#role
Du er senior fullstack-utvikler i TogRefusjon-prosjektet.
Du jobber i Next.js 14 (app router) med TypeScript og Firebase/Firestore, og du har tilgang til eksisterende kodebase (billetter, auth, Firestore-oppsett).

#task
Implementer journeyInstances/claims-logikk som kode:

1. Felles Entur-klient (`enturClient.ts`).
2. Domene-helper for tog/Entur (`enturTog.ts`).
3. Firestore-helpers:
   - `findOrCreateJourneyInstanceForTicket(ticket)`
   - `createClaimForTicket(userId, ticketId)`
4. En enkel test-endepunkt/side som viser hvordan dette brukes.

#specifics
Gjør følgende, stegvis:

## 1. Entur-klient

Opprett `lib/enturClient.ts`:

- Eksporter:
  - `enturQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T>`
- Bruk:
  - URL: `https://api.entur.io/journey-planner/v3/graphql`
  - Header `ET-Client-Name` fra env:
    - `NEXT_PUBLIC_ENTUR_CLIENT_NAME` med fallback (f.eks. "togrefusjon-dev-unknown").
  - `fetch` med:
    - `method: "POST"`
    - `Content-Type: "application/json"`
    - `cache: "no-store"` (vi vil ha ferske data)
- Legg inn enkel feilkontroll:
  - hvis HTTP-feil: kast Error
  - hvis GraphQL `errors` finnes: kast Error med første melding

## 2. Domene-helper for Entur tog

Opprett `lib/enturTog.ts`:

- Implementer minst:
  - `getDeparturesForStopPlace(stopPlaceId: string, numberOfDepartures = 10)`
    - GraphQL-query mot Journey Planner v3
    - returner struktur som inneholder:
      - stopPlace-id og navn
      - estimatedCalls med:
        - aimedDepartureTime / aimedArrivalTime (hvis tilgjengelig)
        - expectedDepartureTime / expectedArrivalTime
        - actualDepartureTime / actualArrivalTime (hvis tilgjengelig)
        - cancellation
        - serviceJourney { id, line { id, publicCode } }
- Legg til en helper:
  - `getJourneyInstanceDataFromEntur(params)` som tar inn:
    - operator
    - trainNumber
    - date
    - fromStopPlaceId / toStopPlaceId
  - og:
    - gjør passende Entur-kall (du kan anta noen forenklinger om nødvendige queries)
    - returnerer et objekt som kan mappes inn i `JourneyInstance`-typen (uten å skrive til DB enda).

Det er lov å gjøre noen forenklinger i mappingen til du ser repoet (f.eks. gå via stopPlace + filtrering på line.publicCode).

## 3. Firestore-helpers

Bruk eksisterende Firestore-oppsett i prosjektet (importer fra der det er definert).

Lag en ny modul, f.eks. `lib/journeyInstances.ts`:

Implementer:

1. `buildJourneyInstanceKeyFromTicket(ticket): string`
   - Bruk:
     - operator (fra billetten)
     - tognummer / linje
     - dato
     - fra/til (NSR:StopPlace-id hvis tilgjengelig, ellers de best tilgjengelige feltene)
   - Oppgaven her er å lage en deterministisk nøkkel som kan brukes til å lete etter eksisterende journeyInstance.

2. `findJourneyInstanceByKey(key: string)`
   - Spørr Firestore etter journeyInstance med denne nøkkelen.
   - Returner objekt + id.

3. `createJourneyInstanceFromTicket(ticket)`
   - Bruk Entur-helper:
     - hent sanntid og planlagt info for reisen
   - Beregn:
     - planned_departure / planned_arrival
     - actual/expected_departure / actual/expected_arrival
     - delay_minutes_arrival
   - Opprett dokument i `journeyInstances`-collection med alle relevante felter fra designet (TR-JR-301).
   - Returner id + data.

4. `findOrCreateJourneyInstanceForTicket(ticket)`
   - Finn nøkkel med `buildJourneyInstanceKeyFromTicket`.
   - Sjekk om journeyInstance finnes.
   - Hvis ja → returner den.
   - Hvis nei → kall `createJourneyInstanceFromTicket`.

Lag i tillegg en modul `lib/claims.ts`:

5. `createClaimForTicket(userId: string, ticketId: string)`
   - Hent billetten fra Firestore.
   - Kall `findOrCreateJourneyInstanceForTicket(ticket)`.
   - Kjør en **enkel** "regel":
     - kalkuler f.eks. delay_minutes_arrival ≥ 60 → `compPct = 25`, ellers 0 (dette er kun placeholder, ikke full juridikk).
   - Opprett dokument i `claims` med:
     - userId
     - ticketId
     - journeyInstanceId
     - ticket_price (fra billetten)
     - calculated_comp_pct
     - calculated_comp_amount
     - basic legal_basis_refs (f.eks. ["EU_2021_782_art19"]) – bare som stub.
   - Returner claim-id.

## 4. Test-side / endepunkt

Opprett en enkel testsiden/route, f.eks.:

- `app/debug/journey-test/page.tsx` **eller** en API-route under `/app/api/...`.

Funksjon:

- For en hardkodet ticketId (eller dummy-ticket hvis det er enklere):
  - Kall `createClaimForTicket(userId, ticketId)`
  - Render/returner JSON med:
    - journeyInstance (fakta om tog og forsinkelse)
    - claim (beregnet kompensasjon osv.)

Hensikten er å verifisere at hele kjeden fungerer:
- billett → journeyInstance (gjenbrukbar) → claim.

#context
- Prosjekt: TogRefusjon.
- Stack:
  - Next.js 14 app router
  - TypeScript
  - Firebase/Firestore
- Det finnes allerede:
  - auth
  - tickets-lagring (billetter fra QR/parser)
  - grunnleggende Firestore-oppsett.
- Du kan lese eksisterende repo-struktur (antatt kjøring med noe ala `claude ccfull` + git-kontekst).
- Vi har tidligere diskutert juridikk og bevispakker, men i denne oppgaven er det nok med en **placeholder** for kompensasjonsregler (enkleste mulig logikk) – hovedfokus er datakjede og struktur.

#examples
- Vis all ny kode i konkrete filer med filstier:
  - `lib/enturClient.ts`
  - `lib/enturTog.ts`
  - `lib/journeyInstances.ts`
  - `lib/claims.ts`
  - `app/debug/journey-test/page.tsx` (eller tilsvarende)
- Bruk moderne TypeScript (typer, async/await, gode navn).
- Kommenter kort ved viktige antagelser (“TODO: refine Entur query once we know exact mapping from ticket → Entur IDs”).

#notes
- Ikke implementer full juridisk regelmotor nå; det kommer i en egen oppgave.
- Anta at vi foreløpig kun håndterer enkle scenarier (én togstrekning per billett, én operator).
