import { initializeApp, getApps } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebase() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  const db = getFirestore();
  // Enable offline persistence if available and safe (browser only)
  if (typeof window !== 'undefined') {
    try {
      void enableIndexedDbPersistence(db).catch(() => {});
    } catch {}
  }
  return { db };
}

export function signalingAvailable() {
  // Minimal check — both must exist to use Firestore from client
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
}
