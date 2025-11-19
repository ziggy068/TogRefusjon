#filename
TR-RU-503-CANCELLED-LOGIC-FIX.md

#role
Du er senior arkitekt for regelmotoren i TogRefusjon. Du kjenner:
- Eksisterende regelmotor (TR-RU-501 base EU-regler + TR-RU-502 operator-overrides)
- Domenemodeller for Ticket, JourneyInstance, DelayResult, RuleInput, RuleOutcome
- At dagens implementasjon gir feil resultat for CANCELLED (f.eks. 50 % eller 0 % ved force majeure)

Du skal nå KUN rette logikken rundt kansellerte tog, uten å knuse resten.

#task
Fiks regelmotoren slik at:

1. Hvis reisen er kansellert (toget ikke gikk):
   - Utfallet skal være FULL refusjon (100 % av billettprisen) for selve reisen.
   - Dette skal gjelde uavhengig av force majeure-flagg.
2. Forsinkelses- og force-majeure-logikken skal bare brukes når reisen faktisk har gått.
3. Testene/debug-UI tydelig viser riktig oppførsel for CANCELLED.

Ikke gjør store refaktoreringer – patch eksisterende struktur på en ryddig måte.

#specifics

## 1. Avklar status-felt på journey

Finn hvor journey-status ligger (f.eks. i JourneyInstance):

- journey.status eller tilsvarende.
- Hvis det ikke finnes et klart status-felt i dag, men du har noe som indikerer kansellering, beskriv kort hva du finner og velg én tydelig måte å sjekke “kansellert” på (f.eks. `journey.isCancelled === true` eller `journey.status === "CANCELLED"`).

Målet: ha én klar boolean-sjekk i regelmotoren, f.eks.:

- `const isCancelled = journey.status === "CANCELLED";`

## 2. Tidlig retur ved cancelled – hovedentry for kravvurdering

Finn entry-funksjonen som resten av systemet bruker, f.eks.:

- `evaluateClaimFromDomainModels` i `lib/rules/index.ts` (eller tilsvarende).

Legg inn en tidlig blokk helt i starten, før forsinkelsesregler og operator-regler:

- Hvis journey er kansellert:

  - Returner et RuleOutcome med:
    - `status: "ELIGIBLE"`
    - `compensationPct: 100`
    - `legalBasis`: inkluder både EU og norsk grunnlag, f.eks.:
      - `"EU_2021_782_cancellation"`
      - `"NO_jernbane_passasjerrett_kansellering"`
    - `reasons`: korte norske setninger, f.eks.:
      - `"Toget ble innstilt. Du har krav på full refusjon av billettprisen."`
      - `"Force majeure påvirker ikke retten til refusjon for en reise som ikke ble gjennomført."`

  - Ikke kall `evaluateBaseCompensation` eller operatør-reglene i denne grenen.

Force majeure:
- Ignorer `isForceMajeure` her – det skal IKKE fjerne retten til refusjon ved kansellering.

## 3. Justering i base/operatør-regler (valgfritt, men viktig å sikre)

Sørg for at base-reglene og operatør-reglene ikke prøver å “finne på noe” for cancelled:

- I `evaluateBaseCompensation`:
  - Hvis du der inne sjekker journey-status, sørg for at CANCELLED enten:
    - håndteres eksplisitt (men helst bare via entry-funksjonen som nevnt over), eller
    - ikke trigges i det hele tatt fordi entry allerede har returnert.

- I operatør-reglene (`evaluateOperatorOverride`):
  - Hvis du i dag bruker delay/force majeure for alle case, sørg for at denne funksjonen ikke brukes for CANCELLED-caser (det bør allerede være dekket av tidlig retur i entry-funksjonen).

Poenget: CANCELLED skal *ikke* falle gjennom forsinkelses- og FM-logikk.

## 4. Test / debug-case for CANCELLED

Oppdater `app/debug/rules-test/page.tsx` (eller tilsvarende debug-side):

Legg inn minst to eksplisitte testscenarier:

1. `journey.status = "CANCELLED"`, `isForceMajeure = false`:
   - Forvent:
     - `status: "ELIGIBLE"`
     - `compensationPct: 100`
     - reasons inneholder tekst om at toget ble innstilt og full refusjon gis.

2. `journey.status = "CANCELLED"`, `isForceMajeure = true`:
   - Forvent:
     - fortsatt `status: "ELIGIBLE"`
     - `compensationPct: 100`
     - reasons forklarer at FM ikke tar bort refusjon for ikke-levert reise.

Visualisering i debug-UI:

- Vis tydelig:
  - journey-status
  - isForceMajeure
  - RuleOutcome (status, pct, legalBasis, reasons)

## 5. Sørg for at forsinkelses-FM fortsatt virker normalt

Verifiser at:

- En reise som **ikke** er kansellert, men forsinket:
  - fortsatt går gjennom eksisterende forsinkelses- og force-majeure-logikk.
- `isForceMajeure = true` på en *ikke-kansellert, forsinket* reise:
  - kan fortsatt sette kompensasjon for forsinkelse til 0 (i tråd med din nåværende modell).

Bare CANCELLED-grenen skal være hard-coded til 100 %.

## 6. Kode-stil / struktur

- Ikke introduser nye dependencies.
- Hold endringen lokal:
  - entry-funksjonen (evaluateClaimFromDomain
