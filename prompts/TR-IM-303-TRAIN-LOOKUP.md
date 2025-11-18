#filename
TR-IM-303-TRAIN-LOOKUP.md

#role
Du er senior fullstack-utvikler i TogRefusjon-prosjektet. Stack:
- Next.js 14 (app-router) + TypeScript
- Tailwind CSS
- Firebase (Auth + Firestore)
- Entur-integrasjon (GraphQL) for togstatus/journeys

Du kjenner eksisterende M5-kode for Entur (togstatus, journey/evidence) og TR-IM-302 (billettimport med Ticket-normalisering og /tickets/add).

#task
Implementer TR-IM-303: Tog-lookup via tognummer + dato, og koble dette inn i billettimporten slik at strekning og tider kan fylles inn automatisk når bruker kjenner tognummeret.

#specifics

1) Entur helper – lookupTrainByNumber

Opprett en ny helper-fil, for eksempel:

- lib/entur/trainLookup.ts

Implementer:

- async function lookupTrainByNumber(params: {
    trainNumber: string;
    serviceDate: string;     // YYYY-MM-DD (lokal dato for avgang)
    operatorCode?: string;   // f.eks. "VY", "SJ", "GOAHEAD" hvis tilgjengelig
  }): Promise<{
    fromStationName: string;
    fromStationId: string;
    toStationName: string;
    toStationId: string;
    plannedDepartureTime: string;  // ISO
    plannedArrivalTime?: string;   // ISO
    serviceJourneyId?: string;
    lineName?: string;
    raw?: any;                     // original Entur-respons for debugging
  } | null>

Krav:

- Bruk eksisterende Entur-klient/oppsett fra M5 (ikke lag en ny fetch-klient eller dupliser base-URL/env-oppsett).
- Filtrer på:
  - gitt tognummer
  - gitt dato (serviceDate)
  - eventuelt operatorCode hvis det er tilgjengelig i dataene
- Hvis flere treff:
  - velg den mest sannsynlige avgangen (for eksempel den første på den dagen, eller den som ligger nærmest et eventuelt klokkeslett hvis du har det tilgjengelig).
- Hvis ingen treff:
  - returner null, ikke kast exception (håndteres høyere opp).

2) Integrasjon mot manuell billettimport (/tickets/add)

Forutsetning: TR-IM-302 har allerede en side som ligner på:

- app/tickets/add/page.tsx

Mål:

- Bruker skal kunne skrive inn:
  - Tognummer
  - Dato (serviceDate)
  - (ev. operatør)
- Klikke en knapp, f.eks. “Hent strekning fra tognummer”
- Få autofylt:
  - Fra-stasjon
  - Til-stasjon
  - Avgangstid (og gjerne ankomsttid)

Implementering:

- Følg mønsteret som allerede brukes i prosjektet for Entur-kall:
  - Hvis det finnes en egen Entur-API-route eller server action, gjenbruk dette mønsteret.
  - Ellers: opprett en enkel server action eller API-route som kaller lookupTrainByNumber og returnerer JSON.
- I app/tickets/add/page.tsx:
  - Legg til knapp “Hent strekning fra tognummer”.
  - Når den trykkes:
    - kall server action / API med tognummer + valgt dato (+ ev. operatorCode)
    - ved suksess:
      - sett state for feltene:
        - fra-stasjon
        - til-stasjon
        - avgangstid (og ev. ankomsttid)
      - vis en toast på norsk, f.eks. “Fant tog og fylte inn strekning.”
    - ved ingen treff:
      - vis en toast: “Fant ikke tog for dette nummeret og datoen. Kontroller informasjonen.”
- All bruker-tekst skal være på norsk.

3) Integrasjon mot QR-flyt (TR-IM-302)

Forutsetning: Det finnes en QR-/parsingflyt (TR-IM-301/302) som gir et ParsedTicket-objekt med minst:

- trainNumber
- departureDate (YYYY-MM-DD) og/eller departureTime

Gjør:

- Etter vellykket QR-parsing:
  - Hvis ParsedTicket allerede har fra–til stasjon og tider → ikke gjør noe ekstra.
  - Hvis ParsedTicket mangler strekning og/eller tider, men har tognummer + dato:
    - kall lookupTrainByNumber før du normaliserer til Ticket.
    - slå sammen info fra:
      - ParsedTicket
      - lookupTrainByNumber-responsen
    - send dette inn til normalizeTicket / saveTicketForUser.
- Ved feil i lookup:
  - fortsett med normalisering/lagring av det du har, men logg/ta høyde for at strekning ikke er automatisk fylt.
  - ikke blokker hele QR-flyten bare fordi lookup feiler.

4) UX/validering

- I /tickets/add:
  - Tognummer og dato bør være påkrevde felt for å aktivere “Hent strekning fra tognummer”.
  - Håndter loading-state på knappen (for eksempel “Søker…”).
  - Ikke overskriv manuelle felter blindt:
    - Hvis bruker allerede har skrevet inn fra–til, kan du:
      - enten spørre (toast/confirm) før du overskriver
      - eller kun autofylle hvis feltene er tomme.
- I QR-flyt:
  - lookup er “best effort”; ingen ekstra UI nødvendig i første versjon, men logg gjerne til console/debug hvis lookup feiler.

5) Testing / debug

- Legg inn en enkel debug-entry (eller utvid eksisterende debug-side) der du kan:
  - Sette tognummer + dato manuelt.
  - Kalle lookupTrainByNumber direkte og vise resultat i `<pre>`.
- Dette kan være under:
  - app/debug/train-lookup/page.tsx (eller tilsvarende), men hold det enkelt og merk det tydelig som debug.

#context
- TogRefusjon har:
  - M5 Entur-integrasjon (togstatus, journeys, evidence).
  - TR-IM-302, som innfører en felles Ticket-modell, lagring i Firestore og /tickets/add for manuell import.
- Målet med TR-IM-303 er å øke automatikk ved billettregistrering:
  - Mindre input fra bruker
  - Mer konsistente strekninger og tider
  - Gjenbruk av Entur-integrasjonen på en kontrollert måte

#examples
Gi:

1) Full implementasjon av lib/entur/trainLookup.ts:
   - med tydelig Entur-spørring (GraphQL) basert på eksisterende klient
   - med feilhåndtering og dokumentasjon i kommentarer.

2) Utdrag/oppdatert kode for app/tickets/add/page.tsx:
   - viser hvordan knappen “Hent strekning fra tognummer” er koblet til server action / API.
   - viser hvordan resultatet brukes til å sette state.

3) Skisse/utdrag for hvordan QR-flyten oppdateres:
   - hvor lookupTrainByNumber kalles
   - hvordan resultatet merges inn før normalizeTicket/saveTicketForUser.

#notes
- Ikke endre eller dupliser eksisterende Entur-oppsett (base URL, headers, env, client). Gjenbruk det som allerede er laget i M5.
- Ikke introducer nye eksterne dependencies – bruk det som allerede finnes (fetch/GraphQL-klient som er i prosjektet).
- Hold koden ryddig og typesikker, med gode typer for både input og output.
- All UI-tekst til bruker skal være på norsk.
