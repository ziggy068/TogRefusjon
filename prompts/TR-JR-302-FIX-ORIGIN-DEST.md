#role
Du er seniorutvikler i TogRefusjon-prosjektet med ansvar for Entur-integrasjon og journey-matching.
Du har allerede implementert TR-JR-302 (journeyInstances/claims) og kjenner koden som ble generert der.

#task
Fiks feilen:
"Error: Could not find origin/destination in service journey VYG:ServiceJourney:2236_348749-R"

Målet er:
1. Å gjøre origin/destination-mapping mer robust (spesielt for Oslo S → Bergen stasjon-testen).
2. Å unngå at debug-flyten krasjer bare fordi vi ikke finner en “perfekt” match.
3. Samtidig beholde nok struktur til at journeyInstance fortsatt gir mening.

#specifics

1. Les først relevant kode:
   - `frontend/src/lib/enturTog.ts`
   - `frontend/src/lib/journeyInstances.ts`
   - `frontend/src/app/api/debug/create-claim/route.ts`
   - `frontend/src/app/debug/journey-test/page.tsx`
   - `frontend/src/types/journey.ts` (eller tilsvarende types)
   - Eventuelle hjelpere for station/NSR-mapping (`STATION_TO_NSR` eller lignende).

2. Finn nøyaktig hvor feilen kastes:
   - Finn `throw new Error("Could not find origin/destination in service journey ...")` eller lignende.
   - Forklar i en kort kommentar i koden hva den funksjonen forventer:
     - Hvilke felter fra Entur brukes til å finne origin/dest?
     - Hvilke NSR-StopPlace-id’er sammenlignes mot?

3. Stasjonsmapping (Oslo S / Bergen stasjon)
   - Verifiser at:
     - Oslo S er mappet til korrekt NSR StopPlace-id (`NSR:StopPlace:59872`).
     - Bergen stasjon er mappet til korrekt NSR StopPlace-id (sjekk mot Entur-data i koden).
   - Hvis det mangler mapping for "Bergen stasjon", legg den inn i `STATION_TO_NSR` eller tilsvarende struktur.
   - Kommenter at dette er en midlertidig hardkodet mapping for MVP (Geocoder/lookup kommer senere).

4. Robust logikk for origin/destination i serviceJourney
   - I funksjonen som analyserer `serviceJourney`:
     - Identifiser hvordan den i dag prøver å finne:
       - origin-index
       - destination-index
     - Forbedre logikken slik at:
       a) Vi tåler at bare én av dem matcher eksakt StopPlace-id.
          - F.eks. finn origin, og bruk “nærmeste tilgjengelige” dest videre i ruten hvis eksakt match mangler.
       b) Vi forsøker flere strategier:
          - match på StopPlace-id
          - hvis ikke treff: match på navn (case-insensitive, trimmed)
          - hvis fortsatt ikke treff: bruk første/ siste stopp i reisen som fallback.
       c) Kun kaster hard error hvis `serviceJourney` ikke har noen stopp/points i det hele tatt, eller hvis reisen åpenbart ikke inneholder noe fornuftig å bygge journeyInstance av.

   - Legg inn logging (console/server) når du må bruke fallback, f.eks.:
     - “WARNING: Using fallback origin/destination for serviceJourney {id} – could not match both endpoints exactly”.

5. Debug/MVP-tilpasning
   - Sørg for at `/debug/journey-test`-flyten *ikke* knekker på denne feilen:
     - For debug: det er bedre å få en “best effort”-journeyInstance enn å kaste exception.
     - Hvis du mener at det er nødvendig, kan du for debug/mid-lag legge inn en flagg/parameter i helperen:
       - `strictMatching: boolean` (true for produksjon, false for debug), og bruke `false` i debug-APIet.

6. Oppdater JourneyInstance-fyling
   - Sørg for at journeyInstance som lagres:
     - har fornuftig `fromStopPlaceId`/`toStopPlaceId`
     - har `serviceDate`, `plannedDeparture`, `plannedArrival` satt basert på den valgte delen av reisen
   - Hvis origin/dest er delvis fuzzy matchet (f.eks. vi brukte første/ siste stopp), lagre dette i et felt:
     - f.eks. `matchingQuality: "EXACT" | "PARTIAL" | "FALLBACK"`.
   - Kommenter at dette feltet kan bli viktig senere i regelmotor/bevisvurdering.

7. Feilhåndtering mot klient
   - I `/api/debug/create-claim`:
     - Sørg for at hvis matching virkelig ikke er mulig (selv med fallback), returneres en ryddig JSON-feil:
       - status 400/500
       - `{ error: "Could not derive journey from Entur data", details: ... }`
     - JourneyTestPage skal vise denne feilen i `result.error` (den støtten finnes allerede).

#context
- Prosjekt: TogRefusjon (Next.js 14, TypeScript, Firebase/Firestore).
- JourneyInstances/claims/evidence er allerede på plass (TR-JR-301/302/303).
- `/debug/journey-test`:
  - lager en testbillett (Oslo S → Bergen, tog 601, 08:25)
  - kaller `/api/debug/create-claim`
  - forventer å vise journeyInstance + claim.

- Nåværende status:
  - Firestore-rules er justert så writes fungerer i DEV.
  - Entur-kall fungerer, men journey-matching ryker med:
    "Could not find origin/destination in service journey VYG:ServiceJourney:2236_348749-R".

#examples
Gi resultatet som:
1. Kort oppsummering av hva som var galt (mapping/matching) og hva du har endret.
2. Konkrete kodeendringer i:
   - `enturTog.ts` (matching + fallback + logging)
   - `journeyInstances.ts` (stasjonsmapping / NSR-id’er / matchingQuality hvis aktuelt)
   - `route.ts` (bedre feilhåndtering mot klient hvis nødvendig).
3. En kort manuell testoppskrift jeg kan kjøre:
   - `npm run dev`
   - gå til `/debug/journey-test`
   - logg inn
   - klikk “Create Test Claim”
   - se journeyInstance + claim vist uten "Could not find origin/destination..."-feil.

#notes
- Prioritet nå er at debugflyten fungerer stabilt med “best effort”-matching.
- Eksakt og juridisk perfekt matching kan strammes inn senere når vi har mer presis mapping (Geocoder, dato, komplette Entur-queries).
