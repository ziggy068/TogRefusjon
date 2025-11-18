#filename
TR-TS-402-AUTO-DELAY-TRACKING.md

#role
Du er senior fullstack-utvikler i TogRefusjon-prosjektet. Stack:
- Next.js 14 (app-router) + TypeScript
- Tailwind CSS
- Firebase (Auth + Firestore)
- Cloud Functions / Cloud Scheduler
- Entur-integrasjon (GraphQL) for togstatus/journeys

Du har allerede:
- Ticket-modell og lagring (/users/{uid}/tickets/{ticketId}) – TR-IM-302/303/304
- lookupTrainByNumber / train lookup – TR-IM-303
- En on-demand forsinkelsessjekk-funksjon (checkDelayForTicket / checkDelayForJourney) – TR-TS-401
- Debug-side for manuell forsinkelsessjekk

#task
Implementer TR-TS-402: enkel automatisk overvåkning av forsinkelser (“auto delay tracking”) ved hjelp av Cloud Functions + Scheduler.

Målet er:
- Ha en periodisk jobb som:
  1) finner relevante journeys/billetter i et tidsvindu
  2) kaller checkDelayForJourney/checkDelayForTicket
  3) oppdaterer Firestore med DelayResult på journey/claim

Dette er en MVP, ikke en super-skalerbar “endelig” løsning.

#specifics

1) Datamodell: hvor lagres forsinkelsesinfo

Bruk eksisterende struktur for journeys/claims, f.eks.:

- /journeyInstances/{journeyInstanceId}
- /claims/{claimId}

Utvid med felter for delay-status, f.eks.:

På journeyInstance-dokument:

- delay:
  - status: "ON_TIME" | "DELAYED" | "UNKNOWN"
  - delayMinutes?: number
  - lastCheckedAt: Timestamp
  - source?: "AUTO" | "MANUAL"
  - raw?: any (kan være trimmed versjon av Entur-respons, ikke full dump)

Hvis du allerede har en struktur for dette, gjenbruk den. Hvis ikke, legg den til nå.

2) Kjernefunksjon (gjenbruk fra TR-TS-401)

Lag en server-side helper i f.eks.:

- functions/src/delay/checkAndStoreDelay.ts
  eller
- lib/server/delay/checkAndStoreDelay.ts (hvis du kjører functions via Next/server)

Funksjonen bør:

- Ta inn en journeyInstance (eller id):
  - hente tilhørende data (tognummer, tider, osv.)
  - kalle checkDelayForJourney / checkDelayForTicket
  - skrive DelayResult tilbake til Firestore-feltet journeyInstance.delay

Signaturforslag:

- async function checkAndStoreDelayForJourney(journeyInstanceId: string): Promise<void>

eller batch-variant:

- async function checkAndStoreDelayForJourneys(journeyInstanceIds: string[]): Promise<void>

Viktig:
- robust feilhåndtering:
  - logg feil
  - ikke stopp hele jobben hvis én journey feiler

3) Utvelgelse av journeys som skal sjekkes (tidsvindu)

Lag en helper som finner journeys som trenger forsinkelsessjekk, f.eks.:

- functions/src/delay/findJourneysToCheck.ts

Strategi (MVP):

- Finn journeys der:
  - departureTime ligger innenfor et fornuftig tidsvindu rundt “nå”
    - f.eks.: `now - 6h` til `now + 2h`
  - OG:
    - delay.status er ikke satt
    ELLER
    - delay.lastCheckedAt er eldre enn X minutter (f.eks. 30)

Pseudo:

- query Firestore:
  - collection: journeyInstances
  - where departureTime >= now - 6h
  - where departureTime <= now + 2h
- filtrer i kode basert på delay-feltet

Returnér en liste med journeyInstanceId og nødvendig metadata.

4) Cloud Function + Scheduler

Opprett en Cloud Function, f.eks.:

- functions/src/index.ts:
  - export const scheduledDelayCheck = functions.pubsub
      .schedule("every 15 minutes")
      .timeZone("Europe/Oslo")
      .onRun(async (context) => {
        // 1. findJourneysToCheck()
        // 2. checkAndStoreDelayForJourneys(...)
      });

Krav:

- Kjør hvert 15. minutt (MVP).
- Logg:
  - antall journeys funnet
  - antall som ble oppdatert
  - evt. feil (men ikke stans hele jobben).
