# TR-DB-202: Firestore Database Specification

## 1. Firestore-struktur (høynivå)

```
/users/{uid}                          # User root document
  - profile/                          # Subcollection
    - data                            # Profile document
  - tickets/{ticketId}                # Subcollection: User's tickets
  - claims/{claimId}                  # Subcollection: User's claims

/tickets/{ticketId}                   # DEPRECATED: Legacy global collection
/legs/{legId}                         # Global collection: Trip legs (reiseetapper)
/claims/{claimId}                     # DEPRECATED: Legacy global collection
/audit/{eventId}                      # Audit log (NO PII, server-side only)
/operators/{operatorId}               # Optional: Operator metadata (public read)
```

### Designvalg: Global vs. Subcollection

**Subcollections (preferred):**
- ✅ `users/{uid}/tickets/{ticketId}` - Enkel å liste per bruker
- ✅ `users/{uid}/claims/{claimId}` - Isolert per bruker
- ✅ `users/{uid}/profile/data` - Nested profil

**Global collections:**
- ✅ `/legs/{legId}` - Delt på tvers av billetter (én billett kan ha flere legs)
- ✅ `/audit/{eventId}` - Append-only audit log (NO PII)
- ❌ `/tickets` og `/claims` (deprecated, bruk subcollections)

**Rasjonale:**
- Subcollections: Enklere sikkerhet (implicit userId), billigere queries
- Global: Når data må deles på tvers av brukere eller er append-only

---

## 2. Detaljert feltspec

### 2.1 User Profile

**Path:** `/users/{uid}/profile/data`

| Felt                    | Type      | Eksempelverdi                | Beskrivelse                                    |
|-------------------------|-----------|------------------------------|------------------------------------------------|
| `fullName`              | string    | "Ola Nordmann"               | Brukerens fulle navn                           |
| `email`                 | string    | "ola@example.com"            | E-post (readonly fra Firebase Auth)            |
| `iban`                  | string?   | "NO9386011117947"            | Kontonummer for refusjon (11 siffer eller IBAN)|
| `consentDataProcessing` | boolean   | true                         | Samtykke til databehandling (GDPR)             |
| `photoURL`              | string?   | "https://..."                | Profilbilde URL (fra Firebase Auth)            |
| `createdAt`             | timestamp | 2025-11-14T10:00:00Z         | Opprettelsestidspunkt                          |
| `updatedAt`             | timestamp | 2025-11-14T11:30:00Z         | Sist oppdatert                                 |

**Pseudo-JSON:**
```json
{
  "fullName": "Ola Nordmann",
  "email": "ola@example.com",
  "iban": "NO9386011117947",
  "consentDataProcessing": true,
  "photoURL": null,
  "createdAt": "2025-11-14T10:00:00Z",
  "updatedAt": "2025-11-14T11:30:00Z"
}
```

---

### 2.2 Ticket

**Path:** `/users/{uid}/tickets/{ticketId}`

| Felt              | Type       | Eksempelverdi                | Beskrivelse                                    |
|-------------------|------------|------------------------------|------------------------------------------------|
| `userId`          | string     | "abc123xyz"                  | Eier (Firebase Auth UID)                       |
| `date`            | string     | "2025-11-15"                 | Reisedato (YYYY-MM-DD)                         |
| `time`            | string     | "14:30"                      | Avgangstid (HH:MM)                             |
| `trainNo`         | string     | "R20"                        | Tognummer                                      |
| `operator`        | string     | "VY"                         | Togselskap                                     |
| `from`            | string     | "Oslo S"                     | Fra-stasjon                                    |
| `to`              | string     | "Lillehammer"                | Til-stasjon                                    |
| `fileURL`         | string?    | "gs://bucket/tickets/..."    | Storage URL til billett-fil (PDF/bilde)        |
| `fileName`        | string?    | "billett_20251115.pdf"       | Filnavn                                        |
| `fileType`        | string?    | "application/pdf"            | MIME-type                                      |
| `description`     | string?    | "Skannet fra QR"             | Beskrivelse/notater                            |
| `source`          | string     | "qr" / "manual" / "email"    | Importmetode                                   |
| `rawQRData`       | string?    | "VY|2025-11-15|14:30|..."    | Rådata fra QR-kode (for debugging)             |
| `status`          | string     | "imported" / "validated"     | Status (imported → validated → tracked)        |
| `importedAt`      | timestamp  | 2025-11-14T10:00:00Z         | Importert tidspunkt                            |
| `claimStatus`     | string?    | "none" / "eligible" / "submitted" | Krav-status (optional)                    |

**Pseudo-JSON:**
```json
{
  "userId": "abc123xyz",
  "date": "2025-11-15",
  "time": "14:30",
  "trainNo": "R20",
  "operator": "VY",
  "from": "Oslo S",
  "to": "Lillehammer",
  "fileURL": "gs://togrefusjon.appspot.com/tickets/abc123xyz/ticket_456.pdf",
  "fileName": "billett_20251115.pdf",
  "fileType": "application/pdf",
  "description": "Skannet fra QR-kode",
  "source": "qr",
  "rawQRData": "VY|2025-11-15|14:30|R20|Oslo S|Lillehammer",
  "status": "validated",
  "importedAt": "2025-11-14T10:00:00Z",
  "claimStatus": "none"
}
```

---

### 2.3 Leg (Reiseetappe)

**Path:** `/legs/{legId}`

| Felt                   | Type       | Eksempelverdi                | Beskrivelse                                    |
|------------------------|------------|------------------------------|------------------------------------------------|
| `legId`                | string     | "abc_R20_20251115_Oslo-Lill" | Idempotensnøkkel: {userId}:{trainNo}:{date}:{from}-{to} |
| `userId`               | string     | "abc123xyz"                  | Eier (Firebase Auth UID)                       |
| `ticketId`             | string?    | "ticket_456"                 | Referanse til billett (hvis relevant)          |
| `trainNo`              | string     | "R20"                        | Tognummer                                      |
| `operator`             | string     | "VY"                         | Togselskap                                     |
| `from`                 | string     | "Oslo S"                     | Fra-stasjon                                    |
| `to`                   | string     | "Lillehammer"                | Til-stasjon                                    |
| `plannedDepartureUTC`  | timestamp  | 2025-11-15T13:30:00Z         | Planlagt avgang (UTC)                          |
| `actualDepartureUTC`   | timestamp? | 2025-11-15T13:45:00Z         | Faktisk avgang (UTC)                           |
| `plannedArrivalUTC`    | timestamp  | 2025-11-15T15:00:00Z         | Planlagt ankomst (UTC)                         |
| `actualArrivalUTC`     | timestamp? | 2025-11-15T15:30:00Z         | Faktisk ankomst (UTC)                          |
| `delayMinutes`         | number?    | 30                           | Forsinkelse i minutter                         |
| `status`               | string     | "pending" / "observing" / "delayed" / "finalized" | Status                      |
| `trackingStatus`       | string     | "active" / "completed" / "failed" | Overvåkningsstatus                        |
| `lastCheckedAt`        | timestamp? | 2025-11-15T15:00:00Z         | Sist sjekket mot API                           |
| `createdAt`            | timestamp  | 2025-11-14T10:00:00Z         | Opprettelsestidspunkt                          |
| `updatedAt`            | timestamp  | 2025-11-15T15:30:00Z         | Sist oppdatert                                 |

**Pseudo-JSON:**
```json
{
  "legId": "abc123xyz:R20:2025-11-15:Oslo-Lillehammer",
  "userId": "abc123xyz",
  "ticketId": "ticket_456",
  "trainNo": "R20",
  "operator": "VY",
  "from": "Oslo S",
  "to": "Lillehammer",
  "plannedDepartureUTC": "2025-11-15T13:30:00Z",
  "actualDepartureUTC": "2025-11-15T13:45:00Z",
  "plannedArrivalUTC": "2025-11-15T15:00:00Z",
  "actualArrivalUTC": "2025-11-15T15:30:00Z",
  "delayMinutes": 30,
  "status": "delayed",
  "trackingStatus": "completed",
  "lastCheckedAt": "2025-11-15T15:30:00Z",
  "createdAt": "2025-11-14T10:00:00Z",
  "updatedAt": "2025-11-15T15:30:00Z"
}
```

---

### 2.4 Claim (Refusjonskrav)

**Path:** `/users/{uid}/claims/{claimId}`

| Felt              | Type       | Eksempelverdi                | Beskrivelse                                    |
|-------------------|------------|------------------------------|------------------------------------------------|
| `claimId`         | string     | "claim_789"                  | Unik ID for kravet                             |
| `userId`          | string     | "abc123xyz"                  | Eier (Firebase Auth UID)                       |
| `legId`           | string     | "abc_R20_20251115_Oslo-Lill" | Referanse til leg                              |
| `ticketId`        | string?    | "ticket_456"                 | Referanse til billett                          |
| `operator`        | string     | "VY"                         | Togselskap                                     |
| `trainNo`         | string     | "R20"                        | Tognummer                                      |
| `date`            | string     | "2025-11-15"                 | Reisedato (YYYY-MM-DD)                         |
| `delayMinutes`    | number     | 30                           | Forsinkelse i minutter                         |
| `ruleVersion`     | string     | "v1.0"                       | Regelmotor-versjon brukt                       |
| `claimAmount`     | number?    | 250                          | Beregnet beløp (NOK)                           |
| `status`          | string     | "draft" / "awaiting-sign" / "submitted" / "accepted" / "rejected" | Status   |
| `pdfURL`          | string?    | "gs://bucket/claims/..."     | Storage URL til generert PDF                   |
| `attachments`     | array?     | ["gs://...", "gs://..."]     | URLs til vedlegg (billett, ID)                 |
| `submittedAt`     | timestamp? | 2025-11-16T10:00:00Z         | Sendt til operator                             |
| `responseAt`      | timestamp? | 2025-11-20T15:00:00Z         | Svar mottatt                                   |
| `createdAt`       | timestamp  | 2025-11-15T16:00:00Z         | Opprettelsestidspunkt                          |
| `updatedAt`       | timestamp  | 2025-11-20T15:00:00Z         | Sist oppdatert                                 |

**Pseudo-JSON:**
```json
{
  "claimId": "claim_789",
  "userId": "abc123xyz",
  "legId": "abc123xyz:R20:2025-11-15:Oslo-Lillehammer",
  "ticketId": "ticket_456",
  "operator": "VY",
  "trainNo": "R20",
  "date": "2025-11-15",
  "delayMinutes": 30,
  "ruleVersion": "v1.0",
  "claimAmount": 250,
  "status": "submitted",
  "pdfURL": "gs://togrefusjon.appspot.com/claims/abc123xyz/claim_789.pdf",
  "attachments": [
    "gs://togrefusjon.appspot.com/tickets/abc123xyz/ticket_456.pdf"
  ],
  "submittedAt": "2025-11-16T10:00:00Z",
  "responseAt": null,
  "createdAt": "2025-11-15T16:00:00Z",
  "updatedAt": "2025-11-16T10:00:00Z"
}
```

---

### 2.5 Audit Log

**Path:** `/audit/{eventId}`

| Felt          | Type       | Eksempelverdi                | Beskrivelse                                    |
|---------------|------------|------------------------------|------------------------------------------------|
| `eventId`     | string     | "evt_001"                    | Unik event ID                                  |
| `timestamp`   | timestamp  | 2025-11-15T16:00:00Z         | Event tidspunkt                                |
| `action`      | string     | "claim_submitted"            | Action type                                    |
| `userId`      | string     | "abc123xyz"                  | User ID (NO OTHER PII)                         |
| `resourceType`| string     | "claim"                      | Resource type (ticket, claim, leg, etc.)       |
| `resourceId`  | string     | "claim_789"                  | Resource ID                                    |
| `metadata`    | map?       | { "operator": "VY", ... }    | Additional metadata (NO PII)                   |
| `ipAddress`   | string?    | "10.0.0.1"                   | Anonymized IP (optional)                       |

**Pseudo-JSON:**
```json
{
  "eventId": "evt_001",
  "timestamp": "2025-11-15T16:00:00Z",
  "action": "claim_submitted",
  "userId": "abc123xyz",
  "resourceType": "claim",
  "resourceId": "claim_789",
  "metadata": {
    "operator": "VY",
    "trainNo": "R20",
    "delayMinutes": 30
  },
  "ipAddress": null
}
```

---

### 2.6 Operator (Optional, Public Metadata)

**Path:** `/operators/{operatorId}`

| Felt              | Type       | Eksempelverdi                | Beskrivelse                                    |
|-------------------|------------|------------------------------|------------------------------------------------|
| `operatorId`      | string     | "VY"                         | Operator ID                                    |
| `name`            | string     | "Vy Tog AS"                  | Fullt navn                                     |
| `email`           | string?    | "kundeservice@vy.no"         | Kontakt e-post                                 |
| `refundRules`     | map?       | { "threshold": 60, ... }     | Refusjonsregler (kan versjoneres)              |

**Pseudo-JSON:**
```json
{
  "operatorId": "VY",
  "name": "Vy Tog AS",
  "email": "kundeservice@vy.no",
  "refundRules": {
    "threshold": 60,
    "percentage": 50
  }
}
```

---

## 3. Sikkerhetsregler (firestore.rules)

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ==========================================
    // Helper Functions
    // ==========================================

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isValidUserData() {
      // Validate that userId matches auth.uid on create
      return request.resource.data.userId == request.auth.uid;
    }

    // ==========================================
    // User Collection
    // ==========================================

    // User root document (read/write own profile)
    match /users/{userId} {
      allow read, write: if isOwner(userId);

      // User profile subcollection
      match /profile/{document=**} {
        allow read, write: if isOwner(userId);
      }

      // User tickets subcollection
      match /tickets/{ticketId} {
        allow read: if isOwner(userId);
        allow create: if isOwner(userId) && isValidUserData();
        allow update, delete: if isOwner(userId);
      }

      // User claims subcollection
      match /claims/{claimId} {
        allow read: if isOwner(userId);
        allow create: if isOwner(userId) && isValidUserData();
        allow update, delete: if isOwner(userId);
      }
    }

    // ==========================================
    // Global Collections (Legacy - DEPRECATED)
    // ==========================================

    // Legacy tickets (global) - prefer users/{uid}/tickets
    match /tickets/{ticketId} {
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && isValidUserData();
      allow update, delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
    }

    // Legacy claims (global) - prefer users/{uid}/claims
    match /claims/{claimId} {
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && isValidUserData();
      allow update, delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
    }

    // ==========================================
    // Legs Collection (Global, User-Scoped)
    // ==========================================

    match /legs/{legId} {
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && isValidUserData();
      allow update: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
    }

    // ==========================================
    // Audit Logs (Server-Side Only)
    // ==========================================

    match /audit/{eventId} {
      // NO client reads or writes
      // Only Cloud Functions can write via Admin SDK
      allow read, write: if false;
    }

    // ==========================================
    // Operators (Public Read, Admin Write)
    // ==========================================

    match /operators/{operatorId} {
      // Public read for operator metadata
      allow read: if true;
      // Only admin/Cloud Functions can write
      allow write: if false;
    }

    // ==========================================
    // Default Deny All
    // ==========================================

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 4. Indekser (firestore.indexes.json)

```json
{
  "indexes": [
    {
      "collectionGroup": "tickets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "importedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "tickets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "claims",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "claims",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "legs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "plannedDepartureUTC", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "legs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "trackingStatus", "order": "ASCENDING" },
        { "fieldPath": "lastCheckedAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 5. Implementasjonsnotater for Frontend

### 5.1 Paths for Common Operations

#### Lese brukerens profil:
```typescript
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

const profileRef = doc(db, "users", auth.currentUser!.uid, "profile", "data");
const profileSnap = await getDoc(profileRef);
const profile = profileSnap.data();
```

#### Lagre billett:
```typescript
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const ticketRef = doc(db, "users", auth.currentUser!.uid, "tickets", ticketId);
await setDoc(ticketRef, {
  userId: auth.currentUser!.uid,
  date: "2025-11-15",
  time: "14:30",
  trainNo: "R20",
  operator: "VY",
  from: "Oslo S",
  to: "Lillehammer",
  fileURL: storageURL,
  fileName: "billett.pdf",
  fileType: "application/pdf",
  source: "qr",
  status: "imported",
  importedAt: serverTimestamp(),
});
```

#### Liste brukerens billetter (sortert etter dato):
```typescript
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

const ticketsRef = collection(db, "users", auth.currentUser!.uid, "tickets");
const q = query(ticketsRef, orderBy("importedAt", "desc"));
const snapshot = await getDocs(q);
const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

#### Liste brukerens krav (filter etter status):
```typescript
const claimsRef = collection(db, "users", auth.currentUser!.uid, "claims");
const q = query(
  claimsRef,
  where("status", "==", "submitted"),
  orderBy("updatedAt", "desc")
);
const snapshot = await getDocs(q);
const claims = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

### 5.2 Koble Billett → Krav

**Anbefalt tilnærming:**
- Lagre `ticketId` og `legId` som felter i claim-dokumentet
- Dette gjør det enkelt å finne claim fra billett og vice versa

```typescript
// Opprett krav fra leg
const claimRef = doc(db, "users", userId, "claims", claimId);
await setDoc(claimRef, {
  userId,
  ticketId: "ticket_456",
  legId: "abc_R20_20251115_Oslo-Lill",
  operator: "VY",
  trainNo: "R20",
  date: "2025-11-15",
  delayMinutes: 30,
  ruleVersion: "v1.0",
  status: "draft",
  createdAt: serverTimestamp(),
});
```

### 5.3 Idempotens og Unike Nøkler

**Leg ID (Idempotent):**
```typescript
function createLegId(userId: string, trainNo: string, date: string, from: string, to: string) {
  return `${userId}:${trainNo}:${date}:${from}-${to}`;
}
```

**Claim ID (Idempotent):**
```typescript
function createClaimId(userId: string, legId: string, ruleVersion: string) {
  return `${userId}:${legId}:${ruleVersion}`;
}
```

### 5.4 Real-time Listeners

For å vise live oppdateringer (f.eks. krav-status):
```typescript
import { onSnapshot } from "firebase/firestore";

const claimRef = doc(db, "users", userId, "claims", claimId);
const unsubscribe = onSnapshot(claimRef, (doc) => {
  const claim = doc.data();
  console.log("Claim updated:", claim);
});

// Cleanup on unmount
return () => unsubscribe();
```

### 5.5 Batch Operations

Når flere dokumenter må oppdateres samtidig:
```typescript
import { writeBatch } from "firebase/firestore";

const batch = writeBatch(db);
batch.set(ticketRef, ticketData);
batch.set(legRef, legData);
await batch.commit();
```

### 5.6 Typesikkerhet

Definer TypeScript-typer basert på feltspec:
```typescript
export interface UserProfile {
  fullName: string;
  email: string;
  iban?: string;
  consentDataProcessing: boolean;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Ticket {
  userId: string;
  date: string;
  time: string;
  trainNo: string;
  operator: string;
  from: string;
  to: string;
  fileURL?: string;
  fileName?: string;
  fileType?: string;
  description?: string;
  source: "qr" | "manual" | "email";
  rawQRData?: string;
  status: "imported" | "validated" | "tracked";
  importedAt: Timestamp;
  claimStatus?: "none" | "eligible" | "submitted";
}

// ... etc for Leg, Claim, AuditEvent
```

---

## 6. GDPR og Data Retention

### 6.1 Dataminimering
- **PII kun i user-scoped collections** (`users/{uid}/*`)
- **Audit logs inneholder INGEN PII** (kun userId, ingen navn/epost/IBAN)
- **Storage-filer krypteres** med KMS (kun referanser i Firestore)

### 6.2 Sletting av Data
```typescript
// Delete user and all subcollections
async function deleteUserData(userId: string) {
  const batch = writeBatch(db);

  // Delete profile
  const profileRef = doc(db, "users", userId, "profile", "data");
  batch.delete(profileRef);

  // Delete all tickets
  const ticketsSnapshot = await getDocs(collection(db, "users", userId, "tickets"));
  ticketsSnapshot.forEach(doc => batch.delete(doc.ref));

  // Delete all claims
  const claimsSnapshot = await getDocs(collection(db, "users", userId, "claims"));
  claimsSnapshot.forEach(doc => batch.delete(doc.ref));

  // Delete user root
  batch.delete(doc(db, "users", userId));

  await batch.commit();
}
```

### 6.3 Retention Policy
- **Active claims**: Beholdes til 12 måneder etter lukking
- **Closed claims**: Auto-delete via Cloud Functions scheduled job
- **Audit logs**: Beholdes i 3 år (anonyme, ingen PII)

---

## 7. Deployment

### Deploy Firestore Rules:
```bash
firebase deploy --only firestore:rules
```

### Deploy Firestore Indexes:
```bash
firebase deploy --only firestore:indexes
```

### Verify Rules in Emulator:
```bash
firebase emulators:start --only firestore
```

---

**END OF SPECIFICATION**
