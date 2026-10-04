"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig, USE_EMULATORS } from "./config";

interface Firebase {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  /** Null until a storage bucket is configured (photos need it; nothing else does). */
  storage: FirebaseStorage | null;
}

let instance: Firebase | null | undefined;

/**
 * The app's one Firebase connection, or null when it isn't configured yet
 * (a fresh clone with no .env.local). Browser only.
 *
 * Firestore keeps a copy of everything on the phone (IndexedDB), so your recipes
 * open with no signal and changes made offline queue up and sync later.
 */
export function getFirebase(): Firebase | null {
  if (instance !== undefined) return instance;
  const config = firebaseConfig();
  if (!config || typeof window === "undefined") return (instance = null);

  const app = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  const storage = config.storageBucket ? getStorage(app) : null;
  // Give up on a stalled upload after a minute; the photo queue retries later.
  if (storage) storage.maxUploadRetryTime = 60_000;

  if (USE_EMULATORS) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8180);
    if (storage) connectStorageEmulator(storage, "127.0.0.1", 9199);
  }

  // Ask the browser not to clear our offline copy when space runs low.
  navigator.storage?.persist?.().catch(() => {});

  return (instance = { app, auth, db, storage });
}
