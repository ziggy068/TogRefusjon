# TP-PLAN-v1  Tog Refusjon (Next.js + Firebase)

**Kort header**  
Stack: Next.js/React (TypeScript, PWA)  Firebase (Auth, Firestore, CF)  
Mål: Fullautomatisert togrefusjon (lav friksjon, lav kost per krav).  
Miljøer: dev / staging / prod (separate Firebase-prosjekter).

## Milepæler (M1M8)
- **M1  Setup**: Repo, struktur, docs, miljøvarsler, CI (lint/build).  
- **M2  Frontend init**: Next.js TS + Tailwind, PWA manifest, grunnlayout.  
- **M3  Auth & DB**: Firebase Auth (e-post/BankID placeholder), Firestore-regler, profilsteg.  
- **M4  Billettimport**: QR-scan, e-post-parser stub, manuelt opplasting; normalisering.  
- **M5  Togstatus**: Integrasjonslag + kø (poll/webhook), tracking av legs, idempotens.  
- **M6  Regelmotor**: Per operatør/terskel, versjonering, testdata.  
- **M7  Kravgenerator**: PDF + vedlegg (billett/ID), auto-send kanal, statusløype.  
- **M8  Varsler & Drift**: E-post/push, metrikker, alarmer, GDPR-sletting.

## Oppgave-IDer (utdrag)
- **Setup**: TR-SET-001 (repo/CI), TR-SET-002 (env/sekret), TR-SET-003 (docs-ramme).
- **Frontend**: TR-FE-101 (init), TR-FE-102 (layout/nav), TR-FE-103 (form/validering).
- **Auth/DB**: TR-AU-201 (Auth-flow), TR-DB-202 (Firestore schema/indekser), TR-SEC-203 (regler).
- **Billettimport**: TR-IM-301 (QR-parse), TR-IM-302 (e-post-parser stub), TR-IM-303 (filopplasting).
- **Togstatus**: TR-TS-401 (provider adapter), TR-TS-402 (polling/kø), TR-TS-403 (idempotens/DLQ).
- **Regelmotor**: TR-RU-501 (motor v1), TR-RU-502 (operatørprofiler), TR-RU-503 (testmatrise).
- **Kravgenerator**: TR-CL-601 (PDF-mal), TR-CL-602 (vedlegg/lagring), TR-CL-603 (send-kanaler).
- **Varsler/Drift**: TR-NFY-701 (notifikasjoner), TR-OBS-702 (metrikker/alarmer), TR-GDPR-703 (sletting).

## Akseptkriterier pr. milepæl (kjerne)
- **M2**: `npm run dev` kjører, PWA manifest tilgjengelig, minimal home.  
- **M3**: Innlogging/logg ut fungerer; Firestore-regler nekter uautoriserte les/skriv.  
- **M4**: QR  normalisert ticket; e-post-stub lagrer rå-payload-ref; opplasting lagrer filref.  
- **M5**: tracking job genereres uten duplikater; legs oppdateres; feilhåndtering med retries/DLQ.  
- **M6**: delay  entitlement beregnes deterministisk; ruleVersion lagres; tests grønn.  
- **M7**: PDF genereres med vannmerke + hash; claim status oppdateres; auto-send stub.  
- **M8**: Notifikasjoner trigges; metrikker eksponert; sletting tømmer PII iht. policy.

## Dataskjema (kort)
users/{userId}  tickets/{ticketId}  legs/{legId}  claims/{claimId}  
audit/{eventId} (aldri PII i logger/metrikker).  
Idempotensnøkler: `{userId}:{ticketId}:{legDate}` (tracking), `{userId}:{legId}:{ruleVersion}` (claim).

## Sikkerhet & GDPR
- Samtykke for billett/ID.  
- PII i kryptert bucket; kun referanser i DB.  
- Minimering + tidsstyrt sletting (f.eks. 12 mnd etter lukket krav).

## Risikoer & tiltak
- **API-rate limits**: batching, backoff, DLQ.  
- **Variasjon i regler**: versjonert motor + operatørprofiler.  
- **Volumtopper**: kø-basert prosessering, bølgevis PDF.

## Neste steg (konkrete tasks)
1) TR-SET-003: Opprett docs-skjelett (done ved denne filen).  
2) TR-FE-101: Init frontend (Next.js TS) + Tailwind + PWA manifest.  
3) TR-AU-201/TR-DB-202/TR-SEC-203: Auth, schema, regler.  
4) TR-IM-301: QR-parser (baseline).  
5) TR-TS-401/402: Tracking pipeline med idempotens.

## Out of scope (MVP)
- Full BankID-integrasjon (erstattes av e-post-sign stub).  
- Komplett partner-API; start med e-post-parser og manuell opplasting.
