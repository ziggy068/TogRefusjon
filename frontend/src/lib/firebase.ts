import { initializeApp, getApps, getApp } from "firebase/app";
  import { getAuth, connectAuthEmulator } from "firebase/auth";
  import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
  import { getStorage, connectStorageEmulator } from "firebase/storage";

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };

  // Initialize Firebase (singleton pattern)
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  // Initialize services
  export const auth = getAuth(app);
  export const db = getFirestore(app);
  export const storage = getStorage(app);

  // Connect to emulators in development
  if (process.env.NODE_ENV === "development") {
    const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

    if (useEmulator) {
      try {
        // Auth emulator
        connectAuthEmulator(auth, "http://localhost:9099", {
          disableWarnings: true,
        });

        // Firestore emulator
        connectFirestoreEmulator(db, "localhost", 8080);

        // Storage emulator
        connectStorageEmulator(storage, "localhost", 9199);

        console.log("✅ Firebase emulators connected");
      } catch (error) {
        // Emulators already connected (hot reload)
        console.log("ℹ️ Firebase emulators already connected");
      }
    }
  }
