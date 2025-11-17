#role
Du er systemarkitekt og database-designer i TogRefusjon-prosjektet.
Du kjenner moderne web-stack (Next.js 14 app router, TypeScript, Firebase/Firestore) og skal lage en ryddig, skalerbar modell.

#task
Design en datamodell for:
1. Togreise-instans ("journeyInstance") – felles fakta og bevis for ett tog på en gitt dato/strekning.
2. Passasjer-krav ("claim") – individuell kobling mellom bruker, billett og journeyInstance.

Målet er:
- Bevis bygges og lagres **per tog-reise**, ikke per passasjer.
- Mange claims kan peke til samme journeyInstance.
- Modellen må støtte juridisk etterprøvbarhet (lagre rådata, regelversjoner osv).

#specifics
Gi:
1. Overordnet modell:
   - Entiteter/tabeller/collections:
     - `journeyInstances`
     - `claims`
     - hvordan de kobles til eksisterende `users` og `tickets` (antatt at billetter allerede finnes).
   - Beskriv formelt: én journeyInstance per tog-reise per dag (operatør + tognummer + dato + fra/til).

2. Felter for `journeyInstances`:
   - Primærnøkkel (for Firestore: dokument-id, men definer også en logisk "natural key").
   - Felter for identitet:
     - operatør (Vy/SJ/GoAhead/…)
     - tognummer / linje
     - dato
     - fra_stop_place_id / til_stop_place_id (NSR:StopPlace-id’er fra Entur)
     - eventuelle Entur-IDer (serviceJourney.id, line.id, osv).
   - Planlagte tider:
     - planned_departure, planned_arrival
   - Faktiske/sanntids tider:
     - actual_departure, actual_arrival (eller expected hvis actual ikke finnes)
     - cancellation-flag
     - delay_minutes_arrival (beregnet og lagret)
   - Årsak/avvik:
     - raw_deviations (rå JSON fra Entur SIRI-SX / deviations-api)
     - classified_cause (enum, f.eks. NORMAL_TECHNICAL, WEATHER_EXTREME, THIRD_PARTY, STRIKE, UNKNOWN)
     - force_majeure_flag (bool)
   - Regel- og bevis-informasjon:
     - rules_snapshot_version (f.eks. "EU2021_782_v1 + NO_forskrift_v2025-02-07 + operator_Vy_v2024-10")
     - evidence_summary (kort tekstlig oppsummering)
     - entur_raw_journey_response (lagring eller referanse til blob path, f.eks. i Storage)
     - created_at, updated_at, locked_at (når vi slutter å endre reisen, f.eks. etter D+2)

3. Felter for `claims`:
   - Primærnøkkel.
   - Referanser:
     - user_id
     - ticket_id (eksisterende billett)
     - journey_instance_id
   - Økonomi:
     - ticket_price
     - calculated_comp_pct
     - calculated_comp_amount
   - Juridikk:
     - legal_basis_refs: liste med referanser (f.eks. ["EU_2021_782_art19", "NO_jernbane_forskrift_§1", "Vy_vilkar_2024_punktX"])
     - force_majeure_flag_at_decision (kopi fra journeyInstance på beslutningstidspunkt)
   - Dokument:
     - generated_letter_url (PDF/fil)
   - Status:
     - status: draft | submitted | accepted | rejected | escalated
     - history / loggfelt hvis det er relevant.

4. Matching-nøkkel for journeyInstance:
   - Beskriv tydelig hvordan du vil konstruere en "natural key" for å finne/opprette journeyInstance:
     - operator + train_number + date + from_stop_place_id + to_stop_place_id
   - Forklar hvordan denne kan brukes til "find or create" i kode for å unngå duplikater.

5. Snapshot-tenkning:
   - Forklar hvorfor vi lagrer snapshots:
     - entur_raw_journey_response
     - raw_deviations
     - rules_snapshot_version
   - Beskriv hvordan dette gir etterprøvbarhet i etterkant (domstol/klage/advokat).

6. Firestore-perspektiv:
   - Foreslå konkrete collections:
     - `journeyInstances/{id}`
     - `claims/{id}`
   - Eller, hvis du mener det er bedre: nested collections under `users`, men vurder nøye med tanke på at journeyInstance er felles for mange brukere.
   - Gi pro/cons for valgt struktur.

#context
- Tech-stack: Next.js 14 (app router), TypeScript, Firebase/Firestore (kom allerede fra prosjektet TogRefusjon).
- Appen parser billetter (QR / bilde) og lagrer dem i Firestore (`tickets`-lignende struktur antas å eksistere).
- Entur brukes som kilde for planlagt vs faktisk tid, årsaker og avvik (Journey Planner v3, SIRI-ET, SIRI-SX / deviations).
- Målet er å bygge en løsning som kan gi juridisk solide krav:
  - tydelig kobling mellom faktum og regelverk
  - gjenbruk av bevis per tog-reise
  - mange passasjerer kan knyttes til samme journeyInstance.

#examples
Gi resultatet som:
1. En kort, overordnet tekstlig forklaring (arkitektur på høyt nivå).
2. Konkrete Firestore-skjemaer i pseudo-JSON, f.eks.:

   journeyInstances/{id}:
   {
     operator: string,
     trainNumber: string,
     ...
   }

   claims/{id}:
   {
     userId: string,
     journeyInstanceId: string,
     ...
   }

3. TypeScript-typer for `JourneyInstance` og `Claim` som kan brukes direkte i prosjektet.

#notes
- Ikke skriv kode for Entur-kall eller regelmotor i denne oppgaven, fokus er ren modell/design.
- Modellen skal være pragmatisk: juridisk robust men fortsatt enkel nok til å implementere i Firestore uten masse spesiallogikk.
