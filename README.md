# Tog Refusjon – Automatisk refusjonsapp for togreiser

## Beskrivelse
TogRefusjon er en applikasjon for automatisk håndtering av refusjoner for forsinkede eller kansellerte togreiser. Applikasjonen forenkler prosessen med å søke om og motta refusjon for ubekvemmeligheter ved togreiser.

## ClaimPilot-arv
Dette prosjektet er bygget med samme arkitektur og beste praksiser som **ClaimPilot (CP-PLAN-v1)**, men tilpasset for togrefusjoner. Vi gjenbruker den velprøvde tekniske stacken og mappestrukturen for rask utvikling og vedlikehold.

## Arkitektur

### Tech Stack
**Frontend:**
- Next.js 15+ (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui (komponentbibliotek)
- PWA (Progressive Web App)

**Backend:**
- Firebase Authentication
- Cloud Firestore (database)
- Cloud Functions (serverless API)

### Mappestruktur
```
D:\TogRefusjon\
├── frontend/          # Next.js applikasjon
│   ├── app/          # App Router pages
│   ├── components/   # React-komponenter (shadcn/ui)
│   ├── lib/          # Utilities og Firebase config
│   ├── public/       # Statiske filer
│   └── styles/       # Tailwind CSS
├── backend/          # Firebase backend
│   ├── functions/    # Cloud Functions
│   └── firestore/    # Firestore regler og indekser
├── docs/             # Dokumentasjon
├── assets/           # Design-ressurser (logoer, bilder)
└── tests/            # E2E og integrasjonstester
```

## Kom i gang

### Forutsetninger
- Node.js 18+
- npm eller pnpm
- Firebase CLI (`npm install -g firebase-tools`)
- Git

### Installasjon

**1. Klon repository:**
```bash
cd D:\TogRefusjon
```

**2. Installer frontend-avhengigheter:**
```bash
cd frontend
npm install
```

**3. Installer backend-avhengigheter:**
```bash
cd ../backend/functions
npm install
```

**4. Konfigurer Firebase:**
- Opprett Firebase-prosjekt på [Firebase Console](https://console.firebase.google.com/)
- Kopier Firebase-konfigurasjon til `frontend/.env.local`
- Konfigurer Firestore og Authentication

**5. Start utviklingsserver:**
```bash
# Frontend
cd frontend
npm run dev

# Backend (emulator)
cd backend
firebase emulators:start
```

## Utviklingsplan
- [ ] Sette opp Next.js frontend med TypeScript
- [ ] Konfigurere Tailwind CSS og shadcn/ui
- [ ] Implementere Firebase Authentication
- [ ] Opprette Firestore database-skjema for refusjonssaker
- [ ] Lage skjema for å registrere forsinkede togreiser
- [ ] Implementere Cloud Functions for automatisk refusjonskrav
- [ ] Integrere med Entur/Vy API for togdata
- [ ] Lage dashboard for oversikt over refusjonssaker
- [ ] Implementere PWA-funksjonalitet
- [ ] Sette opp testing (Jest + Playwright)

## Lisens
Privat prosjekt
