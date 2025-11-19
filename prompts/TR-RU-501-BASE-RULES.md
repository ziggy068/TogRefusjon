#filename
TR-RU-501-BASE-RULES.md

#role
Du er senior fullstack-utvikler og “rule engine-arkitekt” i TogRefusjon-prosjektet. Stack:
- Next.js 14 (app-router) + TypeScript
- Firebase (Auth + Firestore)
- Entur-integrasjon (togstatus, journeys)
- Eksisterende domenemodeller for Ticket, JourneyInstance, Claim, DelayResult

Du skal ikke skrive juss-notat, men en teknisk, testbar regelmotor som kan gi:
- JA/NEI om erstatning
- prosentsats
- henvisning til regelverk
- enkel begrunnelse som kan brukes i UI/brev.

#task
Implementer TR-RU-501: “Base rule engine” for forsinkelse, basert på:
- forsinkelse (DelayResult)
- reisetype/distanse (kort/mellomlang/lang)
- årsak/force majeure-flagg (der det finnes)
- minimumsregler etter jernbanepassasjer-rettigheter (EU/EEA + norsk tilpasning på et forenklet nivå)

Målet:
1) En ren, pure TypeScript-rule engine som tar inn et konsolidert “RuleInput” og returnerer et “RuleOutcome”.
2) Et klart API som senere kan utvides med operatør-spesifikke vilkår (TR-RU-502).

#specifics

1) Datatyper – lib/rules/types.ts

Definer følgende (tilpass navn etter eksisterende modeller, men behold idéen):

- export type DistanceBand = "SHORT" | "MEDIUM" | "LONG";

- export interface RuleInput {
    ticket: Ticket;                 // inneholder pris, operator, strekning osv.
    journey: JourneyInstance;       // inneholder planlagte tider, faktisk tider, distanse etc. om du har det
    delay: DelayResult;             // fra TR-TS-401
    isForceMajeure?: boolean;       // enten manuelt satt eller fra årsakskode
    operatorCode?: string;          // f.eks. "VY", "SJ", "GOAHEAD"
    distanceBand?: DistanceBand;    // hvis du ikke har eksakt km, kan du beregne/binde dette et annet sted
  }

- export type EligibilityStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "UNKNOWN";

- export interface RuleOutcome {
    status: EligibilityStatus;
    compensationPct: number;        // 0–100
    legalBasis: string[];           // f.eks. ["EU_2021_782_art19", "NO_jernbane_forskrift"]
    reasons: string[];              // korte tekstlige begrunnelser på norsk
    debug?: any;                    // valgfritt, for intern logging/test
  }

Poenget: all “juridisk” logikk skal gå via dette API-et.

2) Selve regelmotoren – lib/rules/baseRules.ts

Implementer en hovedfunksjon:

- export function evaluateBaseCompensation(input: RuleInput): RuleOutcome

Foreslått logikk (MVP, forenklet men realistisk):

1. Hvis delay.status = "UNKNOWN" → status: "UNKNOWN", pct: 0, reason: “Kunne ikke beregne forsinkelse”.

2. Hvis isForceMajeure = true → status: "NOT_ELIGIBLE", pct: 0, reason: “Forsinkelsen skyldes force majeure”.

3. Basert på delayMinutes (fra DelayResult):
   - < 60 min → ingen erstatning:
     - status: "NOT_ELIGIBLE"
     - pct: 0
     - reason: “Forsinkelsen er under minstegrensen.”
   - 60–119 min → x% (f.eks. 25% av billettpris)
   - ≥ 120 min → y% (f.eks. 50% av billettpris)
   (La prosentsatsene ligge i en liten konfig/konstant i samme fil, slik at de kan justeres senere.)

4. Hvis du ikke vet distanceBand:
   - håndter likevel regler kun basert på delayMinutes.
   - Legg inn reason: “Distanse ikke kjent, brukte standard forsinkelsesgrenser.”

5. Hvis distanceBand finnes, kan du:
   - legge inn små variasjoner (f.eks. strengere grenser for veldig korte reiser), men hold det enkelt i denne oppgaven.

For hver beslutning:
- fyll inn legalBasis med enkle koder, f.eks.:
  - "EU_2021_782_art19"
  - "NO_jernbane_passasjerrett"
- fyll reasons med korte, norske setninger som kan brukes direkte i UI/brev.

3) Komposisjon – enkel “entrypoint” for resten av systemet

Lag en helper i f.eks. lib/rules/index.ts:

- export function evaluateClaimFromDomainModels(params: {
    ticket: Ticket;
    journey: JourneyInstance;
    delay: DelayResult;
    isForceMajeure?: boolean;
  }): RuleOutcome

Denne skal bare:

1. Mape Ticket/JourneyInstance/DelayResult → RuleInput (inkl. operatorCode, distanceBand hvis du har det).
2. Kalle evaluateBaseCompensation.
3. Returnere RuleOutcome.

Poenget: resten av systemet skal slippe å kjenne til all intern struktur i RuleInput.

4) Bruk i debug-/test-UI

Lag/utvid en debug-side, f.eks.:

- app/debug/rules-test/page.tsx

Krav:

- Vis et enkelt UI som lar deg:
  - velge en JourneyInstance + Ticket (fra Firestore) ELLER hardkode noen test-cases i frontend.
  - trigge `evaluateClaimFromDomainModels`.
- Vis resultatet:
  - status
  - compensationPct
  - legalBasis
  - reasons
  - debug (f.eks. i `<pre>`).

All tekst på norsk:

- Knapp: “Evaluer krav”
- Resultat-tekster: “Berettiget til kompensasjon”, “Ikke berettiget”, “Kan ikke avgjøres” etc.

5) Testbarhet

Legg til enkle, kode-nære tester/fiksturer (selv om du ikke setter opp full test-runner i dette steget):

- I f.eks. lib/rules/fixtures.ts:
  - definer noen RuleInput-eksempler:
    - 30 min forsinkelse → 0%
    - 70 min forsinkelse, ikke force majeure → >0%
    - 130 min forsinkelse, ikke force majeure → høyere %
    - 90 min forsinkelse, force majeure = true → 0%
- Du kan inkludere små “manuelle tester” i form av en funksjon som logger til console, eller korte kommentarer som viser forventet resultat.

6) Forberedelse for operatør-spesifikke regler (TR-RU-502)

Gjør det lett å utvide senere:

- Lag evaluateBaseCompensation slik at den:
  - tar hensyn til operatorCode i input, men i denne oppgaven:
    - bare legger den i debug / reasons, eller
    - bruker den ikke.
- Kommenter i koden hvor du senere vil “hooke inn” operatør-overstyringer:
  - f.eks. evaluateWithOverrides(input) som først sjekker om det finnes egne regler for operatorCode før base-regler brukes.

#context
Du har allerede:

- DelayResult fra TR-TS-401/402 (beregnet forsinkelse).
- JourneyInstance + Ticket fra M4/M5.
- En claim-modell som senere skal bruke resultatet for å:
  - sette claim.status
  - beregne beløp
  - generere brev (TR-CL-601).

TR-RU-501 er bindeleddet mellom “rå” data (forsinkelse, billett, journey) og “krav”.  
Alt lov-/vilkårskaoset skal etter hvert samles her, ikke spres i UI eller brev-generator.

#examples
Gi:

1) Full kode for:
   - lib/rules/types.ts
   - lib/rules/baseRules.ts
   - lib/rules/index.ts

2) Eksempel på RuleInput → RuleOutcome med et par kommenterte case i koden.

3) En svært enkel versjon av app/debug/rules-test/page.tsx som:
   - hardkoder et RuleInput (midlertidig) ELLER
   - lar deg kalle evaluateClaimFromDomainModels på data hentet fra Firestore.

#notes
- Ikke gjør dette juridisk 100 % korrekt og komplett nå; fokuser på:
  - tydelig struktur
  - ren og testbar logikk
  - at det er lett å justere terskler/prosenter senere.
- All tekst som skal eksponeres til bruker (reasons) skal være på norsk.
- Ikke introduser nye dependencies.
