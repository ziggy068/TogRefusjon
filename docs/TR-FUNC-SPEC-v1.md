# TR-FUNC-SPEC-v1 · Funksjonsbeskrivelse

## Formål
Automatisere hele prosessen for togrefusjon: fra billettfangst → overvåkning → regelvurdering → kravgenerering → innsending → oppfølging, med færrest mulig klikk.

## Brukerroller
- User: eier egne data/krav.
- Ops: støtte (lese saker).
- Admin: full tilgang + konfig.
- Auditor: revisjon (audit, ikke PII).

## Kjerneobjekter & tilstander
- Ticket: imported → validated → tracked
- Leg: pending → observing → delayed? → finalized
- Claim: draft → awaiting-sign → submitted → accepted/rejected/needs-info
- Audit: append-only, uten PII

## Datakilder
- Billett: QR, e-post-parser, filopplasting.
- Togstatus: poll/webhook.
- Regelmotor: versjonert policy (ruleVersion).

## Hovedflyt
1) Import → parse og lagre ticket/legs.
2) Overvåking → oppdater actualDep/Arr, beregn delayMin.
3) Vurdering → evaluate(legCtx) → entitlement + ruleVersion → claim draft.
4) Kravgenerering → PDF + vedlegg i KMS-kryptert bucket, hash lagres.
5) Signering/innsending → ett klikk (email-sign nå; BankID senere).
6) Oppfølging → varsler, statusendringer, arkivering.

## Varsler
- Import OK, krav klar, innsending OK, statusendring, mangler info.

## Feilhåndtering
- Retry/backoff + DLQ for eksterne feil.
- Parserfeil → manuell korreksjon.
- Signeringsfeil → ny lenke, begrenset forsøk.

## Sikkerhet & personvern
- Samtykke for billett/ID.
- PII i kryptert bucket, referanser i DB.
- Firestore-regler: eier/ops/admin.
- Audit uten PII; tidsstyrt sletting (f.eks. 12 mnd).

## Skalering
- Kø-baserte jobber per leg/claim; batching; idempotensnøkler.

## Metrikker (KPI)
- Import-suksess, time-to-claim, auto-rate, feilrate, kost/krav.

## Minimal UX
- Legg til billett (QR/e-post/fil) → ved forsinkelse: Send krav → bekreft.
- Statusliste + detaljside; varsler leder til handling.

## Fremtid
- BankID, partner-API, flere operatører/land, utvidelse til fly/buss.
