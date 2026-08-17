import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";

const REMEMBER_KEY = "ccm-admin-remember-me";

export function getRememberMePreference(): boolean {
  return localStorage.getItem(REMEMBER_KEY) !== "false";
}

export function setRememberMePreference(remember: boolean): void {
  localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
}

/** Apply Firebase persistence before sign-in (local = stay signed in, session = until tab/app closes). */
export async function configureAuthPersistence(auth: Auth, remember: boolean): Promise<void> {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  setRememberMePreference(remember);
}
