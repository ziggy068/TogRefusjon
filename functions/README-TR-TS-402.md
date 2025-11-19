# TR-TS-402: Automated Delay Tracking

Automatisk overvåkning av forsinkelser for togreiser med Cloud Functions + Scheduler.

## Oversikt

Denne implementasjonen kjører en scheduled Cloud Function hvert 15. minutt som:

1. **Finner relevante journeys** (`findJourneysToCheck`) - Journeys i tidsvindu (now - 6h til now + 2h)
2. **Sjekker forsinkelse via Entur** (`checkDelayForJourney`) - Kaller Entur GraphQL API
3. **Lagrer resultat i Firestore** (`saveDelayResult`) - Oppdaterer `journeyInstances/{id}`

## Arkitektur

```
scheduledDelayCheck (Scheduled Function, every 15 min)
  ↓
findJourneysToCheck (Query Firestore)
  ↓
checkAndStoreDelayForJourneys (Batch processing)
  ↓
checkDelayForJourney (per journey)
  ↓
getDeparturesForStopPlace (Entur API)
  ↓
saveDelayResult (Update Firestore)
```

## Filer

### Core Files
- `functions/src/index.ts` - Scheduled function definition
- `functions/src/delay/types.ts` - TypeScript types
- `functions/src/delay/findJourneysToCheck.ts` - Query logic
- `functions/src/delay/checkAndStoreDelay.ts` - Batch checking + Firestore persistence
- `functions/src/delay/delayCheck.ts` - Delay check logic
- `functions/src/entur/enturClient.ts` - Entur API client

## Datamodell

### JourneyInstance (Firestore)

```typescript
{
  // Existing fields...
  trainNumber: string;
  operator: string;
  serviceDate: string; // YYYY-MM-DD
  fromStopPlaceId: string; // NSR:StopPlace:xxx
  toStopPlaceId: string;
  plannedDepartureUTC: Timestamp;
  plannedArrivalUTC: Timestamp;

  // New fields (TR-TS-402)
  lastDelayResult: {
    journeyInstanceId: string;
    trainNumber: string;
    operator?: string;
    plannedDepartureTime?: string;
    actualDepartureTime?: string;
    plannedArrivalTime?: string;
    actualArrivalTime?: string;
    departureDelayMinutes?: number;
    arrivalDelayMinutes?: number;
    status: 'ON_TIME' | 'DELAYED' | 'CANCELLED' | 'UNKNOWN';
    checkedAt: string; // ISO timestamp
    source: 'AUTO' | 'MANUAL';
    message?: string;
    rawEntur?: any; // Trimmed Entur response
  };
  lastDelayCheckAt: Timestamp;
}
```

## Deployment

### 1. Build Functions

```bash
cd functions
npm run build
```

### 2. Deploy Scheduled Function

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy only scheduledDelayCheck
firebase deploy --only functions:scheduledDelayCheck
```

### 3. Verify Deployment

```bash
# Check function logs
firebase functions:log --only scheduledDelayCheck

# Or in Firebase Console:
# Functions → scheduledDelayCheck → Logs
```

## Configuration

### Environment Variables

Legg til i `functions/.env`:

```env
ENTUR_CLIENT_NAME=togrefusjon-functions
```

### Scheduler Parameters (i `index.ts`)

```typescript
{
  timeWindowStartHours: 6,    // Check journeys from 6 hours ago
  timeWindowEndHours: 2,      // to 2 hours in the future
  recheckAfterMinutes: 30,    // Re-check if last check was >30 min ago
  maxResults: 100             // Limit to 100 journeys per run
}
```

## Testing

### 1. Test lokalt med Emulator

```bash
# Start emulators
firebase emulators:start

# In another terminal, trigger scheduled function manually
firebase functions:shell
> scheduledDelayCheck()
```

### 2. Test i production (manuell trigger)

```bash
# Call the function manually via gcloud
gcloud scheduler jobs run scheduledDelayCheck --location=europe-west1
```

### 3. Verifiser resultater i Firestore

```javascript
// Query journeyInstances with recent delay checks
db.collection('journeyInstances')
  .where('lastDelayCheckAt', '>=', new Date(Date.now() - 60 * 60 * 1000))
  .get()
  .then(snapshot => {
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`${doc.id}: ${data.lastDelayResult?.status}`);
    });
  });
```

## Monitoring

### Logs

```bash
# View recent logs
firebase functions:log --only scheduledDelayCheck --lines 50

# Follow logs in real-time
firebase functions:log --only scheduledDelayCheck --follow
```

### Metrics

Firebase Console → Functions → scheduledDelayCheck:
- **Invocations** - Antall kjøringer
- **Execution time** - Kjøretid per run
- **Memory** - Minnebruk
- **Errors** - Feilrate

### Alerts

Sett opp alerts i Firebase Console:
- High error rate (>5%)
- Long execution time (>2 minutes)
- Memory limit exceeded

## Kostnader

### Estimated Costs (MVP)

- **Cloud Scheduler**: ~$0.10/month (1 job * 24h * 30 days)
- **Cloud Functions**:
  - 96 invocations/day * 30 days = 2,880 invocations/month
  - @ 100 journeys per run * ~2 seconds per journey = ~200 seconds per run
  - @ 2,880 * 200 = 576,000 seconds/month = 160 GB-seconds/month
  - **~$0.40/month** (under free tier: 400,000 GB-seconds)
- **Entur API**: Gratis (respekter rate limits)
- **Firestore**:
  - Reads: 2,880 * 100 = 288,000 reads/month (~$0.10)
  - Writes: 2,880 * 100 = 288,000 writes/month (~$0.30)

**Total estimate**: **~$0.90/month** (MVP, under 100 journeys per run)

## Limitations (MVP)

1. **No retry logic** - If Entur API fails, journey is marked as UNKNOWN
2. **No rate limiting** - Simple 100ms delay between checks
3. **No alerting** - Manual monitoring via logs
4. **Simple time window** - No smart prioritization (e.g., prioritize journeys closer to departure)
5. **No historical tracking** - Only stores last delay check result

## Future Enhancements

- [ ] Retry logic with exponential backoff
- [ ] Rate limiting and throttling
- [ ] Alert users when delay >15 minutes
- [ ] Store full delay history in subcollection
- [ ] Smart prioritization (check soon-departing journeys more frequently)
- [ ] Dashboard for monitoring delay check status

## Troubleshooting

### Function not running

1. Check scheduler is enabled:
   ```bash
   gcloud scheduler jobs describe scheduledDelayCheck --location=europe-west1
   ```

2. Check function is deployed:
   ```bash
   firebase functions:list
   ```

### No journeys found

1. Check if journeyInstances exist in Firestore
2. Verify `plannedDepartureUTC` is in the time window
3. Check query logs for filter criteria

### Entur API errors

1. Verify `ENTUR_CLIENT_NAME` is set
2. Check `fromStopPlaceId` format (should be `NSR:StopPlace:xxx`)
3. Check Entur API status: https://status.entur.org

### High error rate

1. Check function logs: `firebase functions:log --only scheduledDelayCheck`
2. Look for common error patterns
3. Verify Firestore indexes are created

## Support

For spørsmål eller problemer, kontakt utviklingsteamet eller opprett issue i GitHub repo.
