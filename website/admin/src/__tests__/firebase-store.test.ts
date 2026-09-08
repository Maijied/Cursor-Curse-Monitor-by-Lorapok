import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  clearFirestoreTokenCache,
  getFirestoreSafe,
  isFirestoreFallbackAvailable,
  kvKeyToFirestoreDocId,
  putFirestoreSafe,
  getKvJsonWithFirestoreFallback,
  setFirestoreAccessTokenForTests,
} from "../../functions/api/_shared/firebase-store.js";

const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "cursor-curse-by-lorapok",
  client_email: "test@cursor-curse-by-lorapok.iam.gserviceaccount.com",
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB
wko6Q1lVZtF8pZ9xR8mN0vL2kH3jW4sT6yU1pQ8nX5cA9bE7fG2hI6jK0lM3nO4p
Q5rS6tU7vW8xY9zA0bC1dE2fG3hI4jK5lM6nO7pQ8rS9tU0vW1xY2zA3bC4dE5f
G6hI7jK8lM9nO0pQ1rS2tU3vW4xY5zA6bC7dE8fG9hI0jK1lM2nO3pQ4rS5tU6v
W7xY8zA9bC0dE1fG2hI3jK4lM5nO6pQ7rS8tU9vW0xY1zAgMBAAECggEBAKTm
JaSqdW0yq4YhMz9aKb2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x
4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4
c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5
h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0g1h2i3j4k5l6
m7n8o9p0q1r2s3t4u5v6w7x8y9z0ECAwEAAQKCAQEA1234567890abcdef
-----END PRIVATE KEY-----`,
};

function mockEnv() {
  return {
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(SERVICE_ACCOUNT),
    FIREBASE_PROJECT_ID: "cursor-curse-by-lorapok",
    ADMIN_KV: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
    },
  };
}

describe("firebase-store", () => {
  beforeEach(() => {
    clearFirestoreTokenCache();
    vi.restoreAllMocks();
  });

  it("detects Firestore fallback availability from service account env", () => {
    expect(isFirestoreFallbackAvailable(mockEnv())).toBe(true);
    expect(isFirestoreFallbackAvailable({})).toBe(false);
  });

  it("encodes KV keys to stable Firestore document ids", () => {
    expect(kvKeyToFirestoreDocId("integrations:stats-refresh")).toBeTruthy();
    expect(kvKeyToFirestoreDocId("stats:live-cache")).not.toContain(":");
  });

  it("reads mirrored KV value from Firestore on KV miss", async () => {
    const env = mockEnv();
    setFirestoreAccessTokenForTests("tok");
    const fetchImpl = vi.fn(async (url: string) => {
      return new Response(
        JSON.stringify({
          fields: {
            data: { stringValue: JSON.stringify({ enabled: true }) },
          },
        }),
        { status: 200 }
      );
    });

    const row = await getKvJsonWithFirestoreFallback(env, "integrations:stats-refresh", fetchImpl);
    expect(row?.source).toBe("firestore");
    expect(row?.value).toEqual({ enabled: true });
  });

  it("writes to Firestore via REST PATCH", async () => {
    const env = mockEnv();
    setFirestoreAccessTokenForTests("tok");
    let patchBody = "";
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        patchBody = String(init.body ?? "");
        return new Response(JSON.stringify({ name: "ok" }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const result = await putFirestoreSafe(env, "stats:live-cache", '{"ok":true}', { fetchImpl });
    expect(result.ok).toBe(true);
    expect(result.wrote).toBe(true);
    expect(patchBody).toContain("stats:live-cache");
  });

  it("getFirestoreSafe returns null on 404", async () => {
    const env = mockEnv();
    setFirestoreAccessTokenForTests("tok");
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }));
    const value = await getFirestoreSafe(env, "missing:key", fetchImpl);
    expect(value).toBeNull();
  });
});
