#role
Du er senior fullstack-utvikler i TogRefusjon-prosjektet, med spesielt fokus på Firebase/Firestore security rules og Next.js API-routes.
Du skal KUN finne og fikse årsaken til feilen:
"Error: Missing or insufficient permissions"
i journey-test/claim-flyten, med minimal og trygg endring.

#task
1. Finn nøyaktig hvorfor `Missing or insufficient permissions` oppstår når jeg bruker:
   - `frontend/src/app/debug/journey-test/page.tsx`
   - `/api/debug/create-claim` (TR-JR-302)
2. Foreslå og implementer konkrete endringer enten:
   - i Firestore-rules, og/eller
   - i API-route/kode (f.eks. path/collection-navn/autentisering),
   slik at:
   - debug-flyten "Create Test Claim" fungerer i DEV,
   - journeyInstances og claims kan skrives derfra,
   - uten å åpne opp alt fullstendig i PROD (kommenter tydelig hva som er DEV-midleridig).

#specifics
Gjør følgende stegvis:

1. Les:
   - `firestore.rules`
   - `firestore.indexes.json`
   - `frontend/src/app/debug/journey-test/page.tsx`
   - `frontend/src/app/api/debug/create-claim/route.ts`
   - `frontend/src/lib/journeyInstances.ts`
   - `frontend/src/lib/claims.ts`
   - ev. relevante typer: `frontend/src/types/journey.ts`

2. Identifiser:
   - Hvilke konkrete Firestore-path’er det skrives til i debug-flyten:
     - tickets
     - journeyInstances
     - claims (global og/eller users/{uid}/claims)
   - Hvilke match-blokker i `firestore.rules` som gjelder for hver av disse.
   - Hvor `request.auth` er null (API-route) vs satt (klient).

3. Lag en plan:
   - Beskriv kort:
     - hvor feilen oppstår (eksakt collection/path),
     - hvorfor gjeldende rule-blokk blokkerer write,
     - hvilke minst mulig inngripende endringer som må til for DEV.

4. Implementer:
   - Oppdater `firestore.rules` slik at:
     - journeyInstances kan skrives fra API-routen (som bruker client-SDK uten auth) i DEV.
     - claims som brukes av debug-flyten kan skrives i DEV.
   - Kommenter tydelig i rules:
     - hva som er midlertidig DEV-opplegg,
     - hva som bør strammes inn igjen når vi flytter dette til Admin SDK / Cloud Functions.

   Eksempel-retning (tilpass etter faktisk kode):
   - Egen match-blokk for `journeyInstances` og `claims` med `allow read, write: if isAuthenticated()` ELLER `if true` KUN i DEV, med kommentar.
   - Eller flytt debug-claim-skriving til en use
