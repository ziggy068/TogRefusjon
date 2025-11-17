#role
Du er seniorutvikler i TogRefusjon-prosjektet med fokus på Firebase/Firestore og robust datamodell.
Du skal finne og fjerne alle tilfeller der vi prøver å skrive `undefined` til Firestore, spesielt i journeyInstances/claims-flyten.

#task
Fiks feilen:
"Function addDoc() called with invalid data. Unsupported field value: undefined (found in field actualArrivalUTC in document journeyInstances/...)"

Målet er:
1. Ingen felter med verdi `undefined` sendes til Firestore (journeyInstances, claims, tickets).
2. Felt som kan mangle skal enten:
   - settes til `null`, eller
   - utelates helt fra dokumentet.
3. Debug-flyten `/debug/journey-test` skal kunne kjøre gjennom uten `Unsupported field value: undefined`-feil.

#specifics
Gjør følgende:

1. Les relevant kode:
   - `frontend/src/lib/journeyInstances.ts`
   - `frontend/src/lib/claims.ts`
   - `frontend/src/app/api/debug/create-claim/route.ts`
   - `frontend/src/app/debug/journey-test/page.tsx`
   - ev. typer i `frontend/src/types/journey.ts`

2. Finn alle steder vi skriver til Firestore med potensielt `undefined`:
   - journeyInstances (addDoc/setDoc på `journeyInstances`)
   - claims (global og/eller under `users/{uid}/claims`)
   - test-ticket i `JourneyTestPage` (`users/{uid}/tickets`)

3. For hver `addDoc`/`setDoc`:
   - Identifiser hvilke felter som kan være `undefined` (f.eks. actualArrivalUTC, actualDepartureUTC, delayMinutesArrival, optional felt på tickets osv.).
   - Refaktorer slik at:
     - enten bruker `felt ?? null` (så det lagres som `null` i Firestore),
       f.eks.:
       - `actualArrivalUTC: actualArrivalUTC ?? null`
     - eller bare inkluderer feltet hvis det faktisk har verdi, f.eks.:
       - `if (actualArrivalUTC) data.actualArrivalUTC = actualArrivalUTC;`
   - Sikre at det IKKE finnes noen direkte `...: undefined` i objektene som sendes til Firestore.

4. Vær ekstra nøye med:
   - journeyInstances:
     - `plannedDepartureUTC`, `plannedArrivalUTC`, `actualDepartureUTC`, `actualArrivalUTC`, `delayMinutesArrival`, ev. `cancellation`, `enturRawJourney`, etc.
   - claims:
     - felter som beregnes fra journeyInstance (kompensasjon, tider, osv.)
   - test-ticket:
     - `fileURL`, `fileName`, `fileType`, `rawQRData` – disse må enten
