#filename
TR-TS-401-DELAY-CHECK-MVP.md

#role
Du er senior fullstack-utvikler i TogRefusjon-prosjektet. Stack:
- Next.js 14 (app-router) + TypeScript
- Tailwind CSS
- Firebase (Auth + Firestore)
- Entur-integrasjon (GraphQL) for togstatus/journeys

Prosjektet har allerede:
- Journey/claim-modeller (M5/M6)
- Entur-klient brukt til å hente tog/journey-data
- Ticket-modell og billettimport (TR-IM-302/303)
- Mulighet til å knytte Ticket ↔ JourneyInstance/Claim

#task
Implementer TR-TS-401: “on-demand” forsinkelsessjekk (delay check MVP):

1) Funksjon som, gitt en billett/journey, slår opp status i Entur og beregner forsinkelse.
2) En enkel måte å trigge denne sjekken på (debug-side eller knapp).
3) Lagre/oppdatere resultatet i Firestore på en fornuftig måte (Claim/JourneyInstance).

Dette er **MVP on-demand**, ikke background-jobs eller full “overvåking”.

#specifics

1) Domenemodell: DelayResult

Lag en felles type, f.eks. i `lib/trainStatus/types.ts`:

- export interface DelayResult {
    journeyInstanceId: string;
    trainNumber: string;
    operator?: string;

    plannedDepartureTime?: string;  // ISO
    actualDepartureTime?: string;   // ISO
    plannedArrivalTime?: string;    // ISO
    actualArrivalTime?: string;     // ISO

    departureDelayMinutes?: number; // kan være negativ
    arrivalDelayMinutes?: number;   // kan være negativ

    status: "ON_TIME" | "DELAYED" | "CANCELLED" | "UNKNOWN";

    checkedAt: string;              // ISO tidspunkt for når vi gjorde sjekken
    rawEntur?: any;                 // full/utvalgt Entur-respons for debugging
  }

Hold typen enkel, men nyttig for senere regelmotor.

2) delayCheck-funksjon

Opprett fil, f.eks.:

- `lib/trainStatus/delayCheck.ts`

Implementer:

- async function checkDelayForJourney(params: {
    journeyInstanceId: string;
    trainNumber?: string;
    operatorCode?: string;
    plannedDepartureTime?: string; // ISO
    plannedArrivalTime?: string;   // ISO
    serviceDate?: string;          // YYYY-MM-DD
  }): Promise<DelayResult>

Krav:

- Bruk eksisterende Entur-klient/oppsett (ikke lag en ny base-klient).
- Finn riktig journey/departure i Entur basert på:
  - serviceDate eller plannedDepartureTime
  - trainNumber
  - operatorCode (hvis tilgjengelig)
- Hent ut:
  - planlagt og faktisk avgang/ankomst
- Beregn:
  - departureDelayMinutes = (actualDeparture - plannedDeparture) i minutter
  - arrivalDelayMinutes = (actualArrival - plannedArrival) i minutter
- Sett status:
  - "DELAYED" hvis forsinkelse >= 1 minutt (enkelt for MVP)
  - "ON_TIME" hvis forsinkelse mellom -1 og +1 minutt
  - "CANCELLED" hvis Entur svarer kansellert (hvis denne informasjonen finnes i dataene du allerede bruker)
  - "UNKNOWN" hvis du ikke klarer å bestemme.

Feilhåndtering:

- Hvis Entur-kall feiler eller ingen journey kan matches:
  - returner DelayResult med:
    - status: "UNKNOWN"
    - uten actual-tider
  - ikke kast exception videre – la kalleren håndtere dette.

3) Lagring i Firestore

Bruk eksisterende struktur for JourneyInstance/Claim (juster til det som faktisk brukes i prosjektet, f.eks.):

- `/journeyInstances/{journeyInstanceId}`
- `/claims/{claimId}`

Lag helper i f.eks. `lib/trainStatus/firestore.ts`:

- async function saveDelayResult(result: DelayResult): Promise<void>

Implementer:

- Lagre DelayResult:
  - enten som eget subdocument, f.eks. `/journeyInstances/{id}/delayChecks/{checkedAt}`
  - eller som felt på journeyInstance:
    - `lastDelayResult: DelayResult`
- For MVP er det nok å ha:
  - `lastDelayResult`
  - opsjonelt: et array `delayHistory` hvis det er lett å legge til.

Velg én strategi, dokumenter i kommentar, og implementer den konsekvent.

4) API / server action

Lag en enkel måte å trigge delay-sjekk fra frontend:

Alternativ A (API-route):

- `app/api/journeys/[journeyInstanceId]/delay-check/route.ts`
- POST:
  - body kan være tom; journeyInstanceId hentes fra URL og resten slås opp i Firestore.
- Flow:
  1. Slå opp journeyInstance i Firestore.
  2. Plukk ut nødvendige felter (trainNumber, serviceDate, plannedDepartureTime osv.).
  3. Kall `checkDelayForJourney`.
  4. Kall `saveDelayResult`.
  5. Returner DelayResult som JSON.

Alternativ B (server action):

- Lag en server action i f.eks. `app/(somewhere)/actions.ts` som gjør samme jobb.
- Frontend kaller server action direkte.

Velg det som passer best med det mønsteret du allerede har i prosjektet (API eller server actions), og bruk det konsevent.

5) Enkel UI for å trigge sjekk

MVP: enten debug-side eller knapp på en detaljside.

Variant 1 – debug-side:

- `app/debug/delay-check/page.tsx`:
  - Input-felt for journeyInstanceId (og ev. trainNumber, serviceDate).
  - Knapp “Sjekk forsinkelse”.
  - Kall API/server action.
  - Vis DelayResult i `<pre>` + korte norsk-tekster:
    - “Status: Forsinket X minutter”
    - “Status: I rute”
    - “Status: Ukjent”

Variant 2 – knapp på eksisterende side:

- På `app/journeys/[id]/page.tsx` eller tilsvarende:
  - Legg til knapp “Sjekk forsinkelse nå”.
  - Når den trykkes:
    - kall API/server action med journeyInstanceId
    - vis resultatet (toast + resultatseksjon).

Minstekrav i denne oppgaven:

- ÉN tydelig måte i UI å trigge og se resultatet på, ikke nødvendigvis begge.

6) UX/tekst

Alle bruker-tekster skal være på norsk.

Eksempler:

- Knapp: “Sjekk forsinkelse nå”
- Loading: “Sjekker forsinkelse …”
- Suksess:
  - “Toget er forsinket X minutter.”
  - “Toget er i rute.”
- Ukjent:
  - “Klarte ikke å hente forsinkelsesdata nå.”

Feil:

- Ikke vis rå teknisk feilmelding til bruker.
- Kort beskjed er nok: “Noe gikk galt under forsinkelsessjekk. Prøv igjen.”

#context
- Dette er en **on-demand** delay-sjekk (TR-TS-401).
- Vi bygger IKKE:
  - scheduler, cron, background-jobs
  - avansert retry eller real-time streaming
- Målet er å:
  - ha én ren funksjon (`checkDelayForJourney`)
  - ha et klart Firestore-skjema for resultater
  - ha én enkel UI-knapp/debug-side for å teste og bruke dette.

Dette gir grunnlag for senere oppgaver med automatisk overvåking (TR-TS-402+).

#examples
Gi:

1) Full kode for:
   - `lib/trainStatus/types.ts`
   - `lib/trainStatus/delayCheck.ts`
   - `lib/trainStatus/firestore.ts` (hvis du lager en egen helper der)

2) API-route ELLER server action som:
   - slår opp journeyInstance
   - kaller delayCheck
   - lagrer resultat
   - returnerer DelayResult

3) Én konkret React-side/komponent (full fil) som:
   - viser knapp “Sjekk forsinkelse nå”
   - viser resultatet på en enkel måte.

#notes
- Gjenbruk eksisterende Entur-klient og Firestore-klient.
- Ikke skriv om eksisterende domene-modeller mer enn nødvendig.
- Ingen nye dependencies.
- Hold koden ryddig og typesikker, med gode typer for input/output.
