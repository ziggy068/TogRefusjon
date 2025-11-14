# TP-PLAN-v1  Tog Refusjon (kort primer)
Stack: Next.js/React (TS, PWA) + Firebase (Auth, Firestore, CF). Mål: fullautomatisert togrefusjon m/ lav friksjon og kost.

Milepæler: 
M1 Setup  M2 Frontend init  M3 Auth/DB  M4 Billettimport · M5 Togstatus · M6 Regelmotor · M7 Kravgenerator · M8 Varsler/Drift

Oppgave-IDer (utdrag):
TR-SET-001..003  TR-FE-101..103  TR-AU-201  TR-DB-202  TR-SEC-203  TR-IM-301..303  TR-TS-401..403  TR-RU-501..503  TR-CL-601..603  TR-NFY-701  TR-OBS-702  TR-GDPR-703

Aksept (kjerne): 
M2 dev kjører + manifest  M3 Auth + regler strammer  M4 QRticket normalisert  M5 tracking uten duplikater  M6 entitlement deterministisk v/ ruleVersion  M7 PDF + hash + status  M8 varsler/metrikker/sletting.

Datastruktur: users/{uid}  tickets  legs  claims; audit/* (uten PII). Idempotens: {uid}:{ticketId}:{legDate}, {uid}:{legId}:{ruleVersion}.

Sikkerhet/GDPR: Samtykke, PII i kryptert bucket m/ referanser i DB, minimering, sletting (12 mnd).

Navn: Arbeidsnavn ClaimIt; ClaimPilot anbefalt for videre ekspansjon.
