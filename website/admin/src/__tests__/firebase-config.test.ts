import { describe, expect, it } from "vitest";
import {
  firebaseConfigToGithubSecrets,
  isCompleteFirebaseConfig,
  normalizeFirebaseConfig,
  resolveFirebaseConfigFromEnv,
  toPublicFirebaseClientConfig,
} from "../../functions/api/_shared/firebase-config.js";

describe("firebase-config", () => {
  it("resolves config from VITE_* env bindings", () => {
    const config = resolveFirebaseConfigFromEnv({
      VITE_FIREBASE_API_KEY: "key",
      VITE_FIREBASE_AUTH_DOMAIN: "auth.example",
      VITE_FIREBASE_PROJECT_ID: "proj",
      VITE_FIREBASE_STORAGE_BUCKET: "proj.appspot.com",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
      VITE_FIREBASE_APP_ID: "app",
    });
    expect(config).not.toBeNull();
    expect(isCompleteFirebaseConfig(config)).toBe(true);
  });

  it("maps to GitHub secret names for CI", () => {
    const secrets = firebaseConfigToGithubSecrets(
      normalizeFirebaseConfig({
        apiKey: "k",
        authDomain: "a",
        projectId: "p",
        storageBucket: "s",
        messagingSenderId: "m",
        appId: "i",
        measurementId: "g",
      })
    );
    expect(secrets.VITE_FIREBASE_PROJECT_ID).toBe("p");
    expect(secrets.FIREBASE_PROJECT_ID).toBe("p");
    expect(secrets.VITE_FIREBASE_MEASUREMENT_ID).toBe("g");
  });

  it("strips metadata for public client bootstrap", () => {
    const pub = toPublicFirebaseClientConfig(
      normalizeFirebaseConfig({
        apiKey: "k",
        authDomain: "a",
        projectId: "p",
        storageBucket: "s",
        messagingSenderId: "m",
        appId: "i",
        updatedAt: "now",
        updatedBy: "x",
      })
    );
    expect(pub).toEqual({
      apiKey: "k",
      authDomain: "a",
      projectId: "p",
      storageBucket: "s",
      messagingSenderId: "m",
      appId: "i",
    });
    expect(pub).not.toHaveProperty("updatedAt");
  });
});
