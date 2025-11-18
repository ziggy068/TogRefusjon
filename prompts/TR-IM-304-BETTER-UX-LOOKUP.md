# TR-IM-304: Better UX and Error Handling for Train Lookup

## Oppgave
Forbedre UX, feilhandtering og loading-states i billettimport- og train lookup-flyten.

## Akseptansekriterier

### 1. Robust feilhandtering
- [x] Entur-lookup feil krasjer ikke siden
- [x] Brukervennlige feilmeldinger pa norsk (uten tekniske detaljer)
- [x] Brukeren kan fortsette a fylle inn manuelt ved feil
- [x] Tydelig logging med prefix for debugging

### 2. Loading states
- [x] "Hent strekning"-knappen viser "Soker..." mens kall pagar
- [x] Knappen er disabled under loading
- [x] "Lagre billett"-knappen viser loading state
- [x] State resettes korrekt ved feil (finally-blokk)

### 3. UX etter lagring
- [x] Konsistent strategi: redirect til /billetter med toast
- [x] 1 sekunds delay for redirect for a vise toast
- [x] Toast vises bade ved suksess og feil

### 4. Smart overskriving av felter
- [x] Train lookup overskriver ikke felter som brukeren har fylt inn
- [x] Kun tomme felter fylles automatisk
- [x] Hjelpetekst forklarer dette for brukeren

### 5. Konsistente norske tekster
- [x] Alle knapper, toasts og feilmeldinger pa norsk
- [x] Korte, klare tekster
- [x] Ingen tekniske feilmeldinger til bruker (logges til console)

### 6. Robust QR-flyt
- [x] QR-flyt stopper ikke ved Entur-lookup feil
- [x] Lagrer billett med tilgjengelige data
- [x] Informerer bruker subtilt hvis lookup feilet

## Implementerte endringer

### app/billetter/add/page.tsx

**handleTrainLookup:**
- Forbedret feilmeldinger (norsk, brukervennlige)
- Fjernet tekniske detaljer fra bruker-feilmeldinger
- Bedre logging: [Lookup] prefix + kortere console-meldinger
- Finally-blokk sikrer at isLookingUp resettes

**handleSubmit:**
- Forbedret norske tekster (ma -> ma, pakrevde)
- Fjernet teknisk feilmelding fra toast
- Bedre logging: [Save] prefix
- Finally-blokk sikrer at isSubmitting resettes

**UI-forbedringer:**
- Oppdatert hjelpetekst: "Vi fyller inn operator, strekning og avgangstid automatisk. Du kan justere feltene etterpaa hvis nodvendig."
- Klarere heading: "Automatisk utfylling fra Entur"

### app/scan/page.tsx

**handleQRDetected:**
- Tracker om lookup ble forsøkt (lookupAttempted)
- Viser passende toast avhengig av om lookup feilet:
  - "Billett lagret! Kunne ikke hente stasjonsnavn automatisk." (hvis lookup feilet)
  - "Billett lagret fra QR-kode!" (normal flow)
- Bedre logging: [QR] prefix
- Fjernet tekniske detaljer fra bruker-feilmeldinger

## Feilmeldinger for og etter

### handleTrainLookup

**For:**
- "Fant ikke tog R20 pa 2025-11-19. Kontroller tognummer og dato."
- "Kunne ikke soke etter tog: Network error: Failed to fetch"

**Etter:**
- "Fant ikke tog R20 pa 2025-11-19. Du kan fylle inn feltene manuelt."
- "Kunne ikke hente strekning na. Prov igjen eller fyll inn manuelt."

### handleSubmit

**For:**
- "Kunne ikke lagre billett: FirebaseError: Permission denied"

**Etter:**
- "Kunne ikke lagre billett. Prov igjen."

### QR-flyt

**For:**
- "Kunne ikke lagre billett: ValidationError: Missing fromStation"

**Etter:**
- "Kunne ikke lagre billett. Prov igjen."
- Eller: "Billett lagret! Kunne ikke hente stasjonsnavn automatisk."

## Testing

1. **Train lookup feil:**
   - Fyll inn ugyldig tognummer -> Se brukervennlig feilmelding
   - Vent til Entur timeout -> Se generisk feilmelding uten tekniske detaljer
   - Verifiser at brukeren kan fortsette a fylle inn manuelt

2. **Loading states:**
   - Klikk "Hent strekning" -> Se "Soker..." tekst og disabled knapp
   - Klikk "Lagre billett" -> Se disabled knapp under lagring

3. **UX etter lagring:**
   - Lagre billett -> Se toast i 1 sekund, deretter redirect til /billetter

4. **Smart overskriving:**
   - Fyll inn "Oslo S" manuelt i fra-stasjon
   - Klikk "Hent strekning"
   - Verifiser at "Oslo S" ikke blir overskrevet

5. **QR-flyt:**
   - Skann QR-kode uten stasjonsdata
   - Verifiser at billett lagres selv om Entur-lookup feiler
   - Se passende beskjed om at stasjonsnavn ikke ble hentet

## Tekniske detaljer

### Logging strategi
- Alle logger har prefix for a skille flows:
  - [Lookup] - Train lookup i manual input
  - [Save] - Lagring i manual input
  - [QR] - QR-scanning flow
- Tekniske feil logges til console, men vises ikke til bruker
- Brukervennlige meldinger vises i toasts

### Error recovery
- Try/catch rundt alle async-operasjoner
- Finally-blokker sikrer state cleanup
- Ingen operasjoner kaster feil som ikke blir fanget

## Status
Ferdig implementert og testet
