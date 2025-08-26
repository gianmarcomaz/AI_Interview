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
  const required = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ] as const;

  const missing = required.filter(
    (k) => !(process.env as any)[k] || String((process.env as any)[k]).trim() === ""
  );

  if (missing.length) {
    const msg =
      `[Firebase] Missing env: ${missing.join(
        ", "
      )}. Project ID empty causes Firestore paths like projects//... and breaks reads/writes.`;
    // Surface loudly in both server and client
    if (typeof window !== "undefined") console.error(msg, firebaseConfig);
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
  // SSR: check env presence only
  if (typeof window === "undefined") {
    const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    return typeof pid === "string" && pid.trim().length > 0;
  }
  try {
    // Reuse same validation as getFirebase()
    // If assertFirebaseEnv exists, call it; otherwise emulate the check
    const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!pid || !pid.trim()) throw new Error("missing projectId");
    return true;
  } catch {
    return false;
  }
}
