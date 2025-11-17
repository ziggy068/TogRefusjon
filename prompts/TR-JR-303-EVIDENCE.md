#role
Du er systemarkitekt og backend-utvikler med fokus på etterprøvbarhet og bevisføring.
Du jobber i TogRefusjon-prosjektet og skal lage en struktur og kode for “bevispakker” per tog-reise (journeyInstance), som kan brukes av mange passasjer-krav.

#task
Bygg et opplegg for bevispakker per `journeyInstance`:
1. Definer en egen “evidence”-struktur (TypeScript-typer).
2. Lag helpers som:
   - bygger en bevispakke fra `journeyInstance` + rådata (Entur).
   - kan serialiseres som JSON og brukes både:
     - i intern logg
     - og som grunnlag for generering av kravbrev.

#specifics
Gjør følgende:

1. TypeScript-typer for bevispakke
   - Opprett f.eks. `lib/evidence.ts`.
   - Definer en type som f.eks.:
     - `JourneyEvidence` med felter som:
       - journeyInstanceRef (id + nøkkelfelter: operator, tognummer, dato, fra/til)
       - timing:
         - planned_departure / planned_arrival
         - actual_departure / actual_arrival
         - delay_minutes_arrival
       - cause:
         - raw_deviations (ev. bare referanse til hvor de ligger, hvis ikke alt lagres inni)
         - classified_cause
         - force_majeure_flag
       - entur:
         - hentet_fra: "Entur Journey Planner v3 / SIRI-ET / SIRI-SX"
         - fetched_at
       - rules:
         - rules_snapshot_version
         - legal_basis_refs (liste med referanser til konkrete regler)
       - summary:
         - kort, menneskelesbar oppsummering ("På dato XX var tog YY mellom A og B forsinket Z minutter ved ankomst. Årsak klassifisert som SIGNALFEIL (ikke ekstraordinær omstendighet).").

2. Helper-funksjon for å bygge bevispakke
   - Implementer f.eks.:
     - `buildJourneyEvidence(journeyInstance: JourneyInstance): JourneyEvidence`
   - Denne skal:
     - ta inn en JourneyInstance (fra Firestore)
     - mappe feltene over til en ren struktur
     - generere `summary`-tekst basert på feltene
     - fylle inn `legal_basis_refs` på et enkelt, konfigurerbart vis
       (f.eks. standard: ["EU_2021_782_art19", "NO_jernbane_forskrift", "operator_default_terms"] – kun som stub).

3. Integrasjon mot claims
   - Lag en helper:
     - `attachEvidenceToClaim(claimId: string)`
   - Denne skal:
     - hente claim + tilhørende journeyInstance
     - bygge `JourneyEvidence`
     - lagre et felt i `claims`:
       - `journey_evidence_snapshot` (embedded JSON) **eller** en referanse til egen `evidence`-collection
     - hensikt: hver claim får et snapshot av beviset slik det så ut på beslutningstidspunktet.

4. Bruk i kravbrev-generering (kun struktur)
   - Skisser en funksjon (ikke full implementasjon av PDF) som:
     - tar inn `JourneyEvidence` + claim + ticket
     - gir et strukturert objekt som kan brukes til å generere kravbrev:
       - overskrift/innledning
       - fakta-del (tider, forsinkelse)
       - årsak/force majeure-vurdering
       - regelhenvisninger
       - krav (beløp, prosent).
   - Det er nok å definere TypeScript-typer og en funksjon som returnerer et “letter model”-objekt – selve PDF/HTML-rendering kan være TODO.

#context
- JourneyInstance- og Claim-modell er designet og delvis implementert i tidligere oppgaver (TR-JR-301/302).
- Vi jobber i Firestore og ønsker:
  - gjenbruk av bevis per togreise
  - robusthet hvis regelverk endres senere (vi lagrer snapshot av hvilken regelversjon vi brukte).
- Juridisk mål:
  - kunne forklare en tredjepart (operatør, Forbrukerråd, ev. domstol) nøyaktig:
    - hvilke fakta som ble lagt til grunn
    - hvordan de er knyttet til konkrete regler
    - at mange passasjerer på samme tog bygger på samme faktagrunnlag.

#examples
- Vis TypeScript-typer og helpers i:
  - `lib/evidence.ts`
- Gi eksempel med fiktive data i kommentar:
  - hvordan `JourneyEvidence` ser ut for én konkret forsinkelse.

#notes
- Du trenger ikke implementere den faktiske PDF-genereringen, men legg til rette for det med en ren, seriøs datastruktur.
- Vær eksplisitt på forskjellen mellom:
  - fakta (tider, årsak)
  - juridisk vurdering (legal_basis_refs, force_majeure_flag).
