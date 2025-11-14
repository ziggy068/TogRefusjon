# Environment Setup Guide (TR-SET-002)

## Overview

Tog Refusjon uses separate Firebase projects for each environment to ensure proper isolation of data, secrets, and configurations.

**Environments:**
- **dev**: Local development with Firebase emulators
- **staging**: Pre-production testing with real Firebase services
- **prod**: Production environment

---

## 1. Frontend Environment (.env.local)

### Setup Steps

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Copy the example file:
   ```bash
   cp .env.local.example .env.local
   ```

3. Get Firebase configuration values:

   **Option A: Firebase Console (Recommended)**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Click gear icon → Project Settings → Scroll to "Your apps"
   - Copy the `firebaseConfig` values

   **Option B: Firebase CLI**
   ```bash
   firebase apps:sdkconfig web
   ```

4. Fill in `.env.local` with your values:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=togrefusjon.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=togrefusjon
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=togrefusjon.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123

   # Set to "true" for local development with emulators
   NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
   ```

### Environment Variables Explained

| Variable | Purpose | Public? |
|----------|---------|---------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase SDK configuration | ✅ Yes (safe to expose) |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` | Enable local emulators | ✅ Yes |

**Note:** All `NEXT_PUBLIC_*` variables are embedded in the client bundle and are **safe to expose**. They do not contain secrets.

---

## 2. Cloud Functions Environment (.env)

### Setup Steps

1. Navigate to functions directory:
   ```bash
   cd functions
   ```

2. Copy the example file:
   ```bash
   cp .env.example .env
   ```

3. Fill in **actual secret values** (see sections below)

### Critical Secrets (Required for MVP)

#### A. Train Status APIs

**Entur API** (Norwegian public transport data)
- Sign up: https://developer.entur.org/
- Get API key from developer portal
- Set in `.env`:
  ```env
  ENTUR_API_KEY=your_actual_key_here
  ENTUR_CLIENT_NAME=TogRefusjon
  ```

#### B. Email Service (SendGrid)

- Sign up: https://sendgrid.com/
- Create API key with "Mail Send" permissions
- Verify sender domain/email
- Set in `.env`:
  ```env
  SENDGRID_API_KEY=SG.xxx...
  SENDGRID_FROM_EMAIL=noreply@togrefusjon.no
  SENDGRID_FROM_NAME=Tog Refusjon
  ```

#### C. Storage & Encryption

For PII storage with KMS encryption:

```bash
# Create KMS key ring (one-time setup)
gcloud kms keyrings create togrefusjon-pii \
  --location europe-north1

# Create encryption key
gcloud kms keys create pii-encryption-key \
  --location europe-north1 \
  --keyring togrefusjon-pii \
  --purpose encryption

# Create storage bucket for encrypted PII
gcloud storage buckets create gs://togrefusjon-pii-encrypted \
  --location europe-north1 \
  --uniform-bucket-level-access
```

Set in `.env`:
```env
GCP_KMS_KEY_RING=togrefusjon-pii
GCP_KMS_KEY_NAME=pii-encryption-key
GCP_KMS_LOCATION=europe-north1
PII_STORAGE_BUCKET=togrefusjon-pii-encrypted
```

### Optional Secrets (Post-MVP)

- **Sentry**: Error tracking and monitoring
- **Operator APIs**: Direct integrations with VY, SJ, Go-Ahead
- **Webhook secrets**: For real-time delay notifications

---

## 3. Firebase Project Setup

### Create Separate Projects

You need **three** Firebase projects:

1. **togrefusjon-dev** (or use emulators)
2. **togrefusjon-staging**
3. **togrefusjon-prod**

### Initial Project Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in project root
firebase init

# Select:
# - Firestore
# - Functions
# - Hosting (for Next.js)
# - Storage
# - Emulators (for dev)
```

### Switch Between Environments

```bash
# Use default project (configured in .firebaserc)
firebase use default

# Or specify project explicitly
firebase use togrefusjon-staging

# Or create alias
firebase use --add
# (Select project, give it alias: staging)

# Then use alias
firebase use staging
```

---

## 4. Security Checklist

### Before Committing

Run this checklist **every time** before `git commit`:

- [ ] No `.env` files added to git
- [ ] No `.env.local` files added to git
- [ ] No service account JSON files added
- [ ] No API keys in code comments
- [ ] `.env.example` files updated (if you added new variables)
- [ ] Run `git status` and verify no sensitive files listed

### Verify Gitignore Protection

```bash
# Check what would be committed
git status

# Verify .env files are ignored
git check-ignore frontend/.env.local
git check-ignore functions/.env

# Should output the file paths (meaning they're ignored)
```

### If You Accidentally Committed Secrets

**CRITICAL: Do NOT just remove and re-commit!**

1. **Rotate all exposed secrets immediately** (new API keys, new passwords)
2. Remove from git history:
   ```bash
   # WARNING: This rewrites history
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/.env" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. Force push (coordinate with team):
   ```bash
   git push origin --force --all
   ```

---

## 5. Environment-Specific Configuration

### Development (Local)

```env
# frontend/.env.local
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true

# functions/.env
ENABLE_AUTO_CLAIM_SUBMISSION=false
ENABLE_DELAY_TRACKING=true
ENABLE_EMAIL_NOTIFICATIONS=false  # Use console logs instead
```

Start emulators:
```bash
firebase emulators:start
```

### Staging

```env
# frontend/.env.local
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
NEXT_PUBLIC_FIREBASE_PROJECT_ID=togrefusjon-staging

# functions/.env
ENABLE_AUTO_CLAIM_SUBMISSION=false  # Manual review
ENABLE_EMAIL_NOTIFICATIONS=true
```

### Production

```env
# frontend/.env.local
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
NEXT_PUBLIC_FIREBASE_PROJECT_ID=togrefusjon-prod

# functions/.env
ENABLE_AUTO_CLAIM_SUBMISSION=true
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_PUSH_NOTIFICATIONS=true
```

---

## 6. Cloud Functions Runtime Config

For **production-grade secret management**, use Firebase Runtime Config or Secret Manager:

### Option A: Firebase Runtime Config (Simple)

```bash
# Set secrets (not stored in files)
firebase functions:config:set \
  entur.api_key="YOUR_KEY" \
  sendgrid.api_key="YOUR_KEY"

# Deploy (secrets included automatically)
firebase deploy --only functions

# Access in code:
# functions.config().entur.api_key
```

### Option B: Google Secret Manager (Recommended for Production)

```bash
# Create secret
echo -n "your-api-key" | gcloud secrets create entur-api-key \
  --data-file=- \
  --replication-policy="automatic"

# Grant access to Cloud Functions service account
gcloud secrets add-iam-policy-binding entur-api-key \
  --member="serviceAccount:togrefusjon@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Access in code:
```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const [version] = await client.accessSecretVersion({
  name: 'projects/PROJECT_ID/secrets/entur-api-key/versions/latest',
});
const apiKey = version.payload?.data?.toString();
```

---

## 7. CI/CD Environment Variables

### GitHub Actions Secrets

For automated deployments, add these secrets to GitHub:

**Repository Settings → Secrets and variables → Actions → New repository secret**

Required secrets:
- `FIREBASE_TOKEN` (from `firebase login:ci`)
- `STAGING_FIREBASE_PROJECT_ID`
- `PROD_FIREBASE_PROJECT_ID`

Optional (if using Secret Manager):
- `GCP_SERVICE_ACCOUNT_KEY` (JSON key for deployments)

---

## 8. Troubleshooting

### "Firebase config not found"

- Verify `.env.local` exists and has correct values
- Restart dev server: `npm run dev`
- Check browser console for errors

### "Permission denied" in Firestore

- Ensure Firebase Auth is initialized
- Check Firestore rules in Firebase Console
- Verify user is authenticated: `firebase.auth().currentUser`

### "API key invalid" for external APIs

- Check `.env` file in `functions/` directory
- Verify API key is active in provider's dashboard
- Check for extra spaces/quotes in `.env` file

### Emulators not starting

- Check ports are free (9099, 8080, 5001, 9000)
- Run: `firebase emulators:start --only auth,firestore`
- Check `firebase-debug.log` for errors

---

## 9. Quick Reference Commands

```bash
# Frontend
cd frontend
cp .env.local.example .env.local
npm run dev

# Functions
cd functions
cp .env.example .env
npm run serve  # Uses emulators

# Firebase
firebase login
firebase use default
firebase emulators:start
firebase deploy --only functions
firebase deploy --only hosting

# Verify secrets are gitignored
git status
git check-ignore frontend/.env.local functions/.env
```

---

## Summary: TR-SET-002 Acceptance Criteria

✅ **Completed:**
- `.gitignore` updated with comprehensive secret patterns
- `frontend/.env.local.example` provided
- `functions/.env.example` created with all required variables
- Environment setup documentation (this file)
- Separate environment strategy documented (dev/staging/prod)
- Security checklist for commit safety
- Secret rotation procedures documented

✅ **Verified:**
- No `.env` or `.env.local` files in git history
- Service account keys excluded from git
- Firebase Runtime Config explained
- Google Secret Manager integration documented

---

**Next Steps:**
- Proceed to TR-FE-101 (Frontend initialization)
- Set up Firebase projects for staging and prod
- Configure CI/CD with encrypted secrets
