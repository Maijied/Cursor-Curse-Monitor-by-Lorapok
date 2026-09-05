/**
 * SET-10 Tier D — quick-unlock PIN logic (checklist item 6, device-local half).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearPinUnlockSession,
  createPinRecord,
  isPinUnlockSession,
  loadLocalPinRecord,
  markPinUnlocked,
  pinEnabledForEmail,
  saveLocalPinRecord,
  validatePinInput,
  verifyPin,
} from "../lib/pin-unlock";

const EMAIL = "admin@lorapok.tech";
const PIN = "4242";

describe("pin-unlock", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("validates PIN format", () => {
    expect(validatePinInput("12")).toMatch(/4–6 digits/);
    expect(validatePinInput("abc")).toMatch(/4–6 digits/);
    expect(validatePinInput("1234")).toBeNull();
    expect(validatePinInput("123456")).toBeNull();
  });

  it("creates, stores, and verifies a PIN record", async () => {
    const record = await createPinRecord(EMAIL, PIN);
    saveLocalPinRecord(record);
    expect(pinEnabledForEmail(EMAIL)).toBe(true);
    expect(pinEnabledForEmail("other@lorapok.tech")).toBe(false);
    expect(await verifyPin(EMAIL, PIN, record)).toBe(true);
    expect(await verifyPin(EMAIL, "9999", record)).toBe(false);
    expect(loadLocalPinRecord()?.email).toBe(EMAIL.toLowerCase());
  });

  it("tracks unlock session in sessionStorage", () => {
    expect(isPinUnlockSession()).toBe(false);
    markPinUnlocked();
    expect(isPinUnlockSession()).toBe(true);
    clearPinUnlockSession();
    expect(isPinUnlockSession()).toBe(false);
  });

  it("clears local PIN when record removed", async () => {
    const record = await createPinRecord(EMAIL, PIN);
    saveLocalPinRecord(record);
    expect(pinEnabledForEmail(EMAIL)).toBe(true);
    saveLocalPinRecord(null);
    expect(pinEnabledForEmail(EMAIL)).toBe(false);
  });
});
