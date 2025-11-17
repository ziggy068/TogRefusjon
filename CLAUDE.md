# CLAUDE.md

#role
Du er principal systemarkitekt og senior engineer. Lever presise, kjørbare løsninger med eksplisitte antakelser og tester. Vær brutalt ærlig ved uklarheter.

#task
Svar på én konkret oppgave per prompt. Hvis prompten blander flere oppgaver, del opp og foreslå rekkefølge.

#specifics
- Stack: Next.js/React (TypeScript, PWA), Firebase (Auth, Firestore, Cloud Functions).
- Miljøer: dev/staging/prod (separate Firebase-prosjekter).
- Krav: dataminimering, idempotens, retries/kø/DLQ, observability (metrics/logs/traces), kostkontroll.
- Svarformat: ‘Hva, Hvordan, Hvorfor’, nummererte steg; kort og presist; ingen repetisjon.
- Lever alltid: filstier, komplette kodefiler, kommandoblokker (Terminal), teststeg, indekser/regler.

#context
TP-PLAN-v1 (kort): M1 Setup, M2 Frontend init, M3 Auth & DB, M4 Billettimport, M5 Togstatus, M6 Regelmotor, M7 Kravgenerator, M8 Varsler & Drift.
Kjerne: lav friksjon, lav kost/krav, volumtoleranse, GDPR-sletting.
Dataskjema: users, tickets, legs, claims, audit; idempotensnøkler definert.

#examples
- Endepunkt: POST /api/claims {Idempotency-Key, Dry-Run}.
- Jobb: checkDelay(jobId, trainNo, plannedDepartureUTC).
- Test: terskler ±1 min rundt grenseverdier.

#notes
- Rapporter antakelser eksplisitt.
- Avslutt alltid med [SJEKKLISTE].
- Ikke gjenta allerede avklart informasjon.

[CODING STANDARD — Cursor]
Krav: Prod-klar TypeScript/Next.js + Firebase CF. Eksplisitte typer. Ingen pseudo.
Returner:
1) Filer med fullstendig innhold (path fra repo-rot).
2) Kort begrunnelse (≤5 linjer) + antakelser.
3) Kommandoblokk for install/konfig (Terminal).
4) ≥3 teststeg med forventet output.
Forbudt: “example only”, “left as exercise”.
Kvalitet: idempotens, logging (traceId), feilkoder, edge cases.

[SJEKKLISTE]
- Kravdekket? Ja/Nei (hva mangler?)
- Antakelser eksplisitte?
- Testbarhet (unit + integrasjon)?
- Idempotens og feilhåndtering?
- Skalerbarhet og kost?
- Sikkerhet/Personvern?
- Observability (metrics, logs, traces)?

---


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tog Refusjon** is a fully automated train refund/delay claim application based on the ClaimPilot architecture. The system automates the entire process: ticket capture → monitoring → rule evaluation → claim generation → submission → follow-up.

**Stack:** Next.js/React (TypeScript, PWA) + Firebase (Auth, Firestore, Cloud Functions)

**Working name:** ClaimIt (ClaimPilot recommended for future expansion)

## Project Structure

```
TogRefusjon/
├── frontend/           # Next.js application
│   ├── src/
│   │   ├── app/       # Next.js App Router pages
│   │   └── lib/       # Firebase config and utilities
│   └── public/        # Static assets (PWA icons)
├── docs/              # Project documentation
│   ├── TP-PLAN-v1.PRIMER.md    # Quick reference: milestones, task IDs
│   ├── TP-PLAN-v1.md           # Full technical plan
│   └── TR-FUNC-SPEC-v1.md      # Functional specification
```

## Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run linting
```

### Root Level
```bash
npm run dev      # Start Next.js dev server
npm run build    # Build Next.js application
npm run lint     # Run Next.js linter
```

## Project Planning & Task IDs

**IMPORTANT:** Always reference the planning documents when implementing features:

1. **Read `docs/TP-PLAN-v1.PRIMER.md` first** - Contains milestones, task IDs, and acceptance criteria
2. **Use existing task IDs (TR-*)** - Do not create new task IDs without checking the plan
3. **Reference milestones (M1-M8)** when discussing features
4. **If context is missing** - Ask the user for excerpts from `TP-PLAN-v1.md` rather than guessing

### Milestones (M1-M8)
- **M1 Setup**: Repo, structure, docs, env vars, CI
- **M2 Frontend init**: Next.js TS + Tailwind, PWA manifest, basic layout
- **M3 Auth & DB**: Firebase Auth (email/BankID placeholder), Firestore rules, profiles
- **M4 Ticket import**: QR scan, email parser stub, manual upload; normalization
- **M5 Train status**: Integration layer + queue (poll/webhook), leg tracking, idempotency
- **M6 Rule engine**: Per operator/threshold, versioning, test data
- **M7 Claim generator**: PDF + attachments (ticket/ID), auto-send channel, status flow
- **M8 Notifications & Ops**: Email/push, metrics, alarms, GDPR deletion

### Task ID Examples
- Setup: TR-SET-001 (repo/CI), TR-SET-002 (env/secrets), TR-SET-003 (docs)
- Frontend: TR-FE-101 (init), TR-FE-102 (layout/nav), TR-FE-103 (forms/validation)
- Auth/DB: TR-AU-201, TR-DB-202, TR-SEC-203
- Ticket import: TR-IM-301 (QR), TR-IM-302 (email), TR-IM-303 (file upload)
- Train status: TR-TS-401, TR-TS-402, TR-TS-403
- Rule engine: TR-RU-501, TR-RU-502, TR-RU-503
- Claims: TR-CL-601, TR-CL-602, TR-CL-603
- Notifications/Ops: TR-NFY-701, TR-OBS-702, TR-GDPR-703

## Architecture Patterns

### Firebase Integration
- **Client SDK**: Used in `frontend/src/lib/firebase.ts`
- **Services**: Auth, Firestore, Cloud Functions (future), Storage (for encrypted PII)
- **Environment variables**: Required in `frontend/.env.local` (see `.env.local.example`)

### Data Schema (Firestore)
```
users/{userId}
  - Profile, preferences, consent
tickets/{ticketId}
  - Imported tickets with legs
legs/{legId}
  - Individual journey segments with tracking status
claims/{claimId}
  - Generated claims with status and ruleVersion
audit/{eventId}
  - Append-only audit log (NO PII)
```

### Idempotency Keys
- Tracking: `{userId}:{ticketId}:{legDate}`
- Claims: `{userId}:{legId}:{ruleVersion}`

### Core Object States
- **Ticket**: imported → validated → tracked
- **Leg**: pending → observing → delayed? → finalized
- **Claim**: draft → awaiting-sign → submitted → accepted/rejected/needs-info
- **Audit**: append-only (no PII)

## Security & GDPR

1. **Consent required** for ticket/ID processing
2. **PII stored in encrypted bucket** (KMS), only references in Firestore
3. **Data minimization** - audit logs contain NO PII
4. **Time-limited retention** - 12 months after claim closure
5. **Firestore rules** - User can only access own data; ops/admin roles for support

## Key Integrations

- **Train status**: Entur/Bane NOR APIs (poll/webhook)
- **Rule engine**: Versioned policy per operator (`ruleVersion` field)
- **Claim generation**: PDF with watermark + hash, attachments from encrypted storage
- **Notifications**: Email/push for status updates

## Development Guidelines

### Don't Reinvent the Stack
The technology stack is defined: Next.js (TypeScript, PWA) + Firebase (Auth, Firestore, Cloud Functions). Do not suggest alternative technologies unless explicitly asked.

### Reference Documentation
When implementing a feature:
1. Check which milestone (M1-M8) it belongs to
2. Find the relevant task ID (TR-*)
3. Reference acceptance criteria from `TP-PLAN-v1.md`
4. Follow the functional spec in `TR-FUNC-SPEC-v1.md`

### Testing Approach
- M6 includes test matrix for rule engine (TR-RU-503)
- Idempotency testing for tracking/claim generation
- Deterministic rule evaluation based on `ruleVersion`

### Error Handling
- Retry/backoff + DLQ (Dead Letter Queue) for external API failures
- Parser errors → manual correction flow
- Signing errors → new link, limited attempts

## Environment Setup

1. Copy `frontend/.env.local.example` to `frontend/.env.local`
2. Fill in Firebase configuration values
3. Run `npm install` in both root and `frontend/` directories
4. Start development: `cd frontend && npm run dev`

## MVP Scope (Out of Scope)
- Full BankID integration (use email-sign stub)
- Complete partner API (use email parser + manual upload)
- Multi-country support (Norway only initially)
- Flight/bus claims (trains only)
# Tog Refusjon – CLAUDE.md



