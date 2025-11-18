#role
Du er senior fullstack-utvikler i TogRefusjon-prosjektet. Stack:
- Next.js 14 (app-router) + TypeScript
- Tailwind CSS
- Firebase (Auth + Firestore) via Firebase SDK v10+
Prosjektet har allerede Auth (innlogging), Firestore-oppsett, journey/claim-modeller og debug-sider under /debug.

Du skal implementere TR-IM-302: Billettimport (M4).

#task
Bygg en robust billettimport-flyt for innlogget bruker, med:
1) Felles, normalisert Ticket-modell.
2) Lagring i Firestore per bruker.
3) UI for manuell registrering av billett.
4) Integrasjon mot eksisterende QR-parse-flyt, slik at både QR og manuell input ender i samme Ticket-struktur.

#specifics

1. DOMENEMODELL (Ticket)
- Definer en felles TypeScript-modell for billett, for eksempel i lib/tickets/types.ts:
  - id: string (Firestore doc-id, kan settes separat)
  - userId: string
  - operator: string
  - trainNumber: string
  - departureTime: string (ISO)
  - arrivalTime?: string (ISO)
  - fromStation: string
  - toStation: string
  - passengerName?: string
  - seatInfo?: string
  - priceNOK?: number
  - currency?: string
  - source: "qr" | "manual" | "email"
  - journeyInstanceId?: string
  - claimId?: string
  - createdAt: string eller Firestore Timestamp
  - raw?: any (original parsed payload fra QR/e-post)

- Legg også inn en helper for å konstruere en Ticket fra “løse” input-felter (manual/QR) i for eksempel lib/tickets/normalizeTicket.ts.
- Sørg for at både QR- og manuell-import gjenbruker denne normaliseringen.

2. FIRESTORE-SKJEMA
- Lag helper-funksjoner i for eksempel lib/tickets/firestore.ts:
  - saveTicketForUser(uid: string, ticketInput: Partial<Ticket> | ParsedTicket): Promise<DocumentReference>
  - getTicketsForUser(uid: string): Promise<Ticket[]>
- Bruk følgende struktur i Firestore:
  - /users/{uid}/tickets/{ticketId}
- Sørg for at createdAt settes server-side (FieldValue.serverTimestamp) eller som ISO-string på server/client, men vær konsistent.

3. MANUELL BILLETTIMPORT – UI
- Lag en route for manuell import, for eksempel:
  - app/tickets/add/page.tsx
- Krav til skjema (UI på norsk):
  Felter (minst):
  - Operatør (dropdown eller tekstfelt, f.eks. “Vy”, “SJ”, “Go-Ahead”)
  - Tognummer
  - Dato for avgang
  - Klokkeslett for avgang
  - Fra-stasjon
  - Til-stasjon
  - Pris (NOK, valgfri)
  - Valgfri tekst: “Notater” eller “Referanse”
  (Opplasting av kvittering/bilde kan forberedes som felt, men trenger ikke full Storage-integrasjon nå – det kan være en TODO-kommentar.)

- Når brukeren klikker “Lagre billett”:
  - Validér input (enkelt, men fornuftig: påkrevde felter må være utfylt).
  - Normaliser til Ticket via normalizeTicket.
  - Kall saveTicketForUser(uid, ticketInput).
  - Ved suksess:
    - Vis toast på norsk, f.eks. “Billett lagret”.
    - Redirect til /tickets eller vis lenke til “Gå til billetter”.
  - Ved feil:
    - Vis toast, f.eks. “Kunne ikke lagre billett. Prøv igjen.”

- Rebruk eksisterende design-system/komponenter for Button, Input, Card osv. Ikke finn opp nye patterns hvis appen allerede har et UI-bibliotek.

4. INTEGRASJON MED QR-PARSE (TR-IM-301)
- Det finnes allerede en QR-skanner og en parser (f.eks. ticketParser.ts).
- Etter vellykket parsing av QR:
  - Konverter parsed output til Ticket-input via normalizeTicket (source: "qr").
  - Kall saveTicketForUser(uid, parsedTicket).
  - Vis toast “Billett lagret fra QR”.
  - Eventuelt redirect til /tickets, eller la brukeren bli på samme side men med tydelig tilbakemelding.
- Unngå duplisering: QR-flyten og manuell-flyten skal bruke samme lagringsfunksjoner.

5. AUTH-GATE / TILGANG
- Alle operasjoner på billetter skal kreve innlogget bruker.
- Bruk eksisterende AuthGate / user-hook:
  - /tickets/add skal kun være tilgjengelig for innlogget bruker.
  - Hvis ikke innlogget → redirect til /login.
- I lagrings-funksjoner, alltid bruk uid fra auth-context, ikke fra skjema.

6. NAVIGASJON / UX
- Sørg for at:
  - /tickets får en tydelig inngang til “Legg til billett” (knapp “Legg til billett” → /tickets/add).
  - Når listen er tom, vis en tomstate med:
    - tekst: “Du har ingen billetter ennå.”
    - knapper/lenker: “Skann billett” og “Legg til billett manuelt”.
- All tekst i UI skal være på norsk.

7. IMPLEMENTASJON / FILSTRUKTUR
- Foreslå og implementer konkrete filer, for eksempel:
  - lib/tickets/types.ts
  - lib/tickets/normalizeTicket.ts
  - lib/tickets/firestore.ts
  - app/tickets/add/page.tsx
  - eventuelle hooks: lib/tickets/hooks.ts (useUserTickets, useSaveTicket)
- Oppdater QR-relaterte komponenter/sider til å bruke nye helpers (saveTicketForUser / normalizeTicket).

#context
- Prosjektet har allerede:
  - Auth og brukerhenting (uid).
  - En /tickets-side (eller planlagt TR-FE-202) som viser liste over billetter.
  - Debug-sider som kan brukes til testing (for eksempel /debug/journey-test, /debug/claim-letter).
- Målet med TR-IM-302 er å få:
  - “ekte” billettdata inn i systemet
  - én konsistent Ticket-modell
  - både QR og manuell import som første versjon av M4.

#examples
Svar med:
1) Fullstendige fil-eksempler (hele filer), med tydelige filstier i toppen, for eksempel:
   - // app/tickets/add/page.tsx
   - // lib/tickets/types.ts
2) Forklaring (kort) i tekst over hver fil om hva den gjør.
3) Kort beskrivelse av hvordan QR-flyten skal oppdateres (hvilke funksjoner som skal kalles hvor).

#notes
- Endre kun det som er nødvendig for TR-IM-302 (billettimport).
- Ikke introduser nye, tunge avhengigheter.
- Vær eksplisitt og konkret, slik at jeg kan kopiere koden rett inn i de oppgitte filene.
