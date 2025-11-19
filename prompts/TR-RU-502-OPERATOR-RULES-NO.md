#filename
TR-RU-502-OPERATOR-RULES-NO.md

#role
Du er senior systemarkitekt for regelmotoren i TogRefusjon. Du kjenner:
- EU-regler for jernbanepassasjerer (forordning 1371/2007 / 2021/782)
- Norske togselskapers reisegarantier (Vy, SJ Norge, Go-Ahead)
- Eksisterende RuleInput / RuleOutcome fra TR-RU-501 (base EU-regler)

Du skal IKKE gjøre en juridisk fullutredning, men bygge en teknisk modell som sikrer at vi:
- aldri krever mindre enn EU-minimum
- samtidig utnytter mer gunstige norske operatørregler (50 % ved 30/60 min for Vy/SJ/Go-Ahead).

#task
Implementer TR-RU-502: operatør-spesifikke kompensasjonsregler for norske togselskaper.

Målet:
1) En egen modul som kjenner til Vy / SJ / Go-Ahead sine mer gunstige vilkår.
2) En funksjon som kombinerer:
   - EU-base (fra TR-RU-501)
   - operatør-ordning
   og velger den HØYESTE kompensasjonsprosenten.

#specifics

## 1. Utvid typer (hvis nødvendig)

I `lib/rules/types.ts` (eller tilsvarende fra TR-RU-501):

- Sørg for at RuleInput har:
  - operatorCode?: string;     // f.eks. "VY", "SJ", "GOAHEAD"
  - distanceBand?: DistanceBand; // "SHORT" | "MEDIUM" | "LONG"
  - lineCode?: string;         // f.eks. F6/F7/Oslo-Bergen/Flåm-Myrdal hvis tilgjengelig

Hvis dette allerede finnes, gjenbruk. Hvis ikke, legg det til nå.

## 2. Operatør-skjema – lib/rules/operatorSchemas.ts

Lag en liten konfig med kjente norske operatører:

- Vy
- SJ Norge
- Go-Ahead Nordic

Forenklet modell:

- For hver operatør, skill mellom:
  - "LONG_DISTANCE" (fjerntog – typisk Oslo–Bergen / Oslo–Trondheim / Trondheim–Bodø osv.)
  - "OTHER" (regiontog, lokaltog, kortere strekninger)

Kompensasjon (forenklet MVP, basert på vilkår og Forbrukerrådet):

- LONG_DISTANCE:
  - ≥ 60 min forsinkelse → 50 % kompensasjon
- OTHER:
  - ≥ 30 min forsinkelse → 50 % kompensasjon

Implementer som typesikker config, f.eks.:

- type OperatorCode = "VY" | "SJ" | "GOAHEAD" | "OTHER";

- interface OperatorCompRule {
    minDelayMinutes: number;
    compensationPct: number;
  }

- interface OperatorScheme {
    longDistance?: OperatorCompRule;
    other?: OperatorCompRule;
  }

- const OPERATOR_SCHEMES: Record<OperatorCode, OperatorScheme> = { ... }

MERK:
- For “OTHER” (ukjent operatør) kan du la scheme være tomt → da gjelder bare EU-base.

## 3. Funksjon: operatorOverride – lib/rules/operatorRules.ts

Lag funksjon:

- export function evaluateOperatorOverride(input: RuleInput): RuleOutcome | null

Oppførsel:

1. Hvis operatorCode ikke er en av "VY" | "SJ" | "GOAHEAD" → returner null (ingen override).
2. Finn delayMinutes fra input.delay (DelayResult).
   - Hvis delay.status = "UNKNOWN" → returner null (vi kan ikke overstyre).
3. Bestem om reisen er LONG_DISTANCE eller OTHER:
   - Hvis journey har eksplisitt flagg (f.eks. journey.isLongDistance / distanceBand === "LONG") → bruk det.
   - Hvis lineCode tilsier fjerntog (f.eks. "F6", "F7", "Oslo-Bergen", "Flam-Myrdal") → LONG_DISTANCE.
   - Ellers fall tilbake til OTHER.

4. Slå opp riktig OperatorCompRule i OPERATOR_SCHEMES.
   - Hvis ingen relevant regel → returner null.

5. Hvis delayMinutes < minDelayMinutes → returner null (ingen kompensasjon etter operatør-ordning).

6. Hvis vi har treff:
   - Returner et RuleOutcome med:
     - status: "ELIGIBLE"
     - compensationPct: fra OperatorCompRule (typisk 50)
     - legalBasis:
       - f.eks. ["EU_2021_782_art19", "VY_reisevilkar_prisavslag", ...]
     - reasons:
       - korte norske tekster, f.eks.:
         - "Operatørens reisegaranti gir 50 % kompensasjon ved forsinkelse over 30 minutter."
         - "For fjerntog gir operatørens vilkår 50 % kompensasjon ved forsinkelse over 60 minutter."

## 4. Kombinasjon: base + operatør – lib/rules/combined.ts

Lag en funksjon på toppen:

- export function evaluateWithOperatorRules(input: RuleInput): RuleOutcome

Flyt:

1. Kall `evaluateBaseCompensation(input)` fra TR-RU-501 → `baseOutcome`.
2. Kall `evaluateOperatorOverride(input)` → `operatorOutcome` (kan være null).
3. Sammenlign:
   - Hvis operatorOutcome finnes og `operatorOutcome.compensationPct > baseOutcome.compensationPct`:
     - velg operatorOutcome som “vinnende”, MEN:
       - slå sammen legalBasis og reasons (f.eks. concat).
   - Ellers:
     - bruk baseOutcome.

4. Hvis både baseOutcome og operatorOutcome gir 0 %:
   - status: "NOT_ELIGIBLE" (eller "UNKNOWN" hvis delay-status er UNKNOWN i base).

Poenget:
- Vi skal ALDRI ende med lavere kompensasjon enn EU-minimum.
- For Vy/SJ/Go-Ahead vil vi typisk havne på 50 % fra 30/60 min i stedet for 25/50 % fra EU.

## 5. Integrasjon – evaluateClaimFromDomainModels

Oppdater helperen fra TR-RU-501 (f.eks. `evaluateClaimFromDomainModels`) til å bruke:

- `evaluateWithOperatorRules(input)`

i stedet for bare `evaluateBaseCompensation`.

Pass på at:

- operatorCode i RuleInput settes riktig basert på:
  - ticket.operator / journey.operator / produktkode.
- distanceBand / isLongDistance settes hvis du har nok data; hvis ikke, kan du:
  - anta "OTHER" for nå, og heller utvide senere når du har bedre datagrunnlag.

## 6. Debug / verifikasjon

Utvid `app/debug/rules-test/page.tsx`:

- Legg til noen faste test-cases for:
  - Vy regiontog 35 min forsinkelse:
    - base EU → 0 %
    - operator → 50 % (vi skal ende på 50 %)
  - Vy Oslo–Bergen 70 min forsinkelse:
    - base EU → 25 %
    - operator (LONG_DISTANCE) → 50 %
    - forventet: 50 %
  - Ukjent operatør 70 min forsinkelse:
    - base EU → 25 %
    - operator → null
    - forventet: 25 %

Vis tydelig i debug-UI:
- hvilken regel som “vant”
- hvilke legalBasis og reasons som ble brukt.

#context
- TR-RU-501 gir EU-minimum (25 % ved 60–119 min, 50 % ved ≥120 min).
- Norske operatører Vy, SJ Norge og Go-Ahead har mer generøse vilkår:
  - 50 % ved 60 min på langdistansetog
  - 50 % ved 30 min på øvrige tog
- Denne oppgaven handler om å legge inn disse som overstyringer (“operator overrides”) slik at TogRefusjon aldri foreslår lavere kompensasjon enn det operatøren faktisk praktiserer.

#examples
Gi:

1) Full kode for:
   - lib/rules/operatorSchemas.ts
   - lib/rules/operatorRules.ts
   - lib/rules/combined.ts

2) Oppdatert:
   - lib/rules/index.ts (evaluateClaimFromDomainModels → bruker evaluateWithOperatorRules)

3) Oppdatert/utvidet:
   - app/debug/rules-test/page.tsx med minst 2–3 test-scenarier som demonstrerer at:
     - operatørreglene overstyrer EU når det gir høyere kompensasjon
     - EU-reglene gjelder som fallback for ukjente operatører.

#notes
- All tekst som skal vises til bruker (reasons) skal være på norsk.
- Ikke introduser nye dependencies.
- Ikke hardkod ekstremt detaljerte linjekoder – bruk enkle heuristikker (distanceBand / isLongDistance / noen få kjente linjer) med TODO-kommentar om at det kan finjusteres senere.
