#role
Du er senior fullstack-utvikler i TogRefusjon-prosjektet, med spesielt ansvar for Entur-integrasjon og journeyInstance-logikk.
Du har allerede implementert TR-JR-302 (journeyInstances/claims) og kjenner koden som ble generert der.

#task
Fiks feilen:
"Error: No matching journey found for train 601 departing around 08:25 from NSR:StopPlace:548"
i debug-flyten for `JourneyTestPage`, og gjør journey-matching mer robust for DEV/MVP:

1. Rett opp feil/stubbet mapping for Oslo S (NSR StopPlace-id).
2. Gjør matching mot Entur-data mindre skjør:
   - For debug/MVP, velg en “best effort”-journey i stedet for å kaste feil hvis det finnes relevante avganger.
3. Sørg for at debug-siden /debug/journey-test kan gjennomføre full flyt:
   ticket → journeyInstance → claim → evidence (om det er koblet inn), uten å krasje på “no matching journey”.

#specifics
Gjør følgende:

1. Les relevant kode:
   - `frontend/src/lib/enturTog.ts`
   - `frontend/src/lib/journeyInstances.ts`
   - `frontend/src/lib/claims.ts`
   - `frontend/src/app/debug/journey-test/page.tsx`
   - `frontend/src/app/api/debug/create-claim/route.ts`
   - eventuelle typer: `frontend/src/types/journey.ts`

2. Oslo S / StopPlace-id
   - Finn stub-mappingen for stasjoner (f.eks. `STATION_TO_NSR` eller lignende).
   - Rett Oslo S til korrekt Entur StopPlace-id (NSR:StopPlace:59872).
   - Kommenter at dette er midlertidig hardkodet mapping og at Geocoder/lookup kommer senere.

3. Robust journey-matching (getJourneyInstanceDataFromEntur)
   - Identifiser funksjonen som:
     - henter Entur-data (Journey Planner v3)
     - filtrerer på tognummer / linje (601)
     - filtrerer på tidspunkt rundt billettens `time`
     - kaster feil "No matching journey found..." hvis ingen match.
   - For DEV/MVP, gjør følgende forbedringer:
     a) Øk `timeRange` i GraphQL-queryen slik at vi får nok avganger rundt aktuell dato/tid (forklar valg kort i kommentar).
     b) Implementer en “best effort”-strategi:
        - Prøv først eksakt/snever matching (tognummer + tid).
        - Hvis ingen treff:
          - prøv mer liberal matching (samme tognummer/linje, nærmest i tid).
        - Hvis fortsatt ingen treff:
          - i DEV: velg første tilgjengelige avgang fra stasjonen (eller første fra samme line), og logg en warning.
     c) Bare kast hard feil hvis det virkelig ikke finnes noen `estimatedCalls` i det hele tatt.
   - Legg inn konsoll-logging/server-logging (med moderat detaljnivå) når fallback-strategien brukes, så vi kan se hva Entur faktisk returnerte.

4. Feilhåndtering mot klient
   - Sørg for at API-routen `/api/debug/create-claim`:
     - ikke bare kaster rå Error videre, men returnerer en meningsfull error-json til klienten dersom matching virkelig feiler.
     - håndterer både “ekte kritisk feil” og “ingen journey funnet” på en kontrollert måte.
   - I `JourneyTestPage`, vis en forståelig feilmelding i `result.error` hvis API-et svarer med error (det finnes allerede, bare bruk den).

5. Tilpassing til test-ticket
   - Vurder om hardkodet test-ticket (`trainNo: "601"`, `date: "2025-01-17"`, `time: "08:25"`, `from: "Oslo S"`, `to: "Bergen stasjon"`) bør justeres for å passe bedre med typisk Entur-data:
     - Kommenter i koden hvis du gjør forenklinger, f.eks. at dato foreløpig ikke brukes direkte i Entur-queryen.
   - Poenget er at debug-siden skal fungere stabilt nå, selv om mapping/dato ikke er 100% perfekt.

#context
- Prosjekt: TogRefusjon, Next.js 14 app router, TypeScript, Firebase/Firestore.
- TR-JR-301/302/303 er implementert (journeyInstances, claims, evidence).
- Debug-siden `/debug/journey-test`:
  - lager en test-ticket for Oslo S → Bergen, tog 601, kl. 08:25
  - kaller `/api/debug/create-claim`
  - forventer å vise journeyInstance + claim i JSON.
- Nå feiler flyten på journey-matching mot Entur med meldingen "No matching journey found...".
- Vi er i DEV, så det er viktigere å få kjeden til å virke med “best effort”-matching enn å ha perfekt produksjonslogikk.

#examples
Gi resultatet som:
1. Kort forklaring på hva som var galt (ID + for streng matching) og hva som ble endret.
2. Konkrete endringer i:
   - `enturTog.ts` (query + matching/fallback)
   - `journeyInstances.ts` (station mapping / Oslo S-id)
   - ev. `route.ts` / debug-page for bedre feilhåndtering / logging.
3. En liten manuell testoppskrift:
   - `npm run dev`
   - gå til `/debug/journey-test`
   - logg inn
   - klikk “Create Test Claim”
   - forvent at journeyInstance + claim vises uten “No matching journey found”-feil.

#notes
- Ikke implementer full Geocoder/ID-lookup nå – bare en ryddig MVP med hardkodede mappinger og robust fallback.
- Vær nøye med å kommentere hva som er midlertidig DEV/MVP-atferd, vs. hva som bør strammes inn når vi kobler på mer nøyaktige Entur-spørringer og dato-basert matching.
