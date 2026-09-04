import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function configFromViteEnv(): FirebaseClientConfig | null {
  const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY ?? "").trim();
  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "").trim();
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "").trim(),
    projectId,
    storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "").trim(),
    messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "").trim(),
    appId: String(import.meta.env.VITE_FIREBASE_APP_ID ?? "").trim(),
    measurementId: String(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "").trim() || undefined,
  };
}

async function fetchRemoteFirebaseConfig(): Promise<FirebaseClientConfig> {
  const res = await fetch(`${API_BASE}/firebase-config`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.config?.apiKey) {
    throw new Error(data?.error || "Firebase is not configured. Set values in Mission Control → Settings → Firebase.");
  }
  return data.config as FirebaseClientConfig;
}

let app: FirebaseApp | null = null;
let bootstrapPromise: Promise<void> | null = null;

export let auth!: Auth;
export let db!: Firestore;
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Loads Firebase config from local VITE_* env or `/api/firebase-config`, then initializes the SDK.
 */
export async function bootstrapFirebase(): Promise<void> {
  if (app) return;
  const config = configFromViteEnv() ?? (await fetchRemoteFirebaseConfig());
  app = getApps().length > 0 ? getApp() : initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
}

export function ensureFirebaseBootstrap(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapFirebase();
  }
  return bootstrapPromise;
}
