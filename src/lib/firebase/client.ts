// src/lib/firebase/client.ts
import { getApps, initializeApp, getApp, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  enableIndexedDbPersistence,
  Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function assertFirebaseEnv() {
  // IMPORTANT: use direct property access so Next.js inlines values in the client bundle
  const API_KEY     = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const AUTH_DOMAIN = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const PROJECT_ID  = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const APP_ID      = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  const missing: string[] = [];
  if (!API_KEY || !API_KEY.trim())       missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!AUTH_DOMAIN || !AUTH_DOMAIN.trim()) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!PROJECT_ID || !PROJECT_ID.trim())  missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!APP_ID || !APP_ID.trim())         missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");

  if (missing.length) {
    const msg = `[Firebase] Missing env: ${missing.join(
      ", "
    )}. Project ID empty causes Firestore paths like projects//... and breaks reads/writes.`;
    if (typeof window !== "undefined") {
      // Optional: dump what we think config is (helps verify at runtime)
      console.error(msg, {
        apiKey: API_KEY,
        authDomain: AUTH_DOMAIN,
        projectId: PROJECT_ID,
        appId: APP_ID,
      });
    }
    throw new Error(msg);
  }
}

let _app: FirebaseApp | null = null;
export function getFirebase(): FirebaseApp {
  assertFirebaseEnv();
  if (!_app) {
    _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return _app!;
}

let _db: Firestore | null = null;
export function getDb(): Firestore {
  if (_db) return _db;
  const app = getFirebase();
  const db = getFirestore(app);

  // Persistence only in the browser (ignore on SSR)
  if (typeof window !== "undefined") {
    // Best-effort; ignore multi-tab/incognito errors
    enableIndexedDbPersistence(db).catch(() => {});
  }
  _db = db;
  return _db!;
}

// Optional: quick runtime visibility in the browser console
export function logFirebaseProjectId() {
  if (typeof window !== "undefined") {
    console.log("[Firebase] projectId =", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  }
}

// Is Firebase signaling (Firestore) available for the client?
// - Safe on server and client
// - Never throws; returns false if required envs are missing
export function signalingAvailable(): boolean {
  // SSR: direct access is fine
  const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (typeof window === "undefined") {
    return Boolean(PROJECT_ID && PROJECT_ID.trim());
  }
  try {
    // On client, assert via direct properties (inlined by Next.js)
    assertFirebaseEnv();
    return true;
  } catch {
    return false;
  }
}
