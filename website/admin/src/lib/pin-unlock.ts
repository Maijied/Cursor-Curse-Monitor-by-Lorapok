/**
 * Local PIN unlock (PBKDF2 hash). PIN never stored plaintext — same pattern as cred vault pin, device-local + optional KV backup.
 */

const LOCAL_KEY = "ccm-admin-pin-v1";
const UNLOCK_KEY = "ccm-admin-pin-unlocked";

type StoredPin = {
  email: string;
  hash: string;
  salt: string;
};

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function derivePinHash(pin: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const saltBytes = new Uint8Array(salt);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: 120_000, hash: "SHA-256" },
    key,
    256
  );
  return bufferToHex(bits);
}

export function validatePinInput(pin: string): string | null {
  const value = pin.trim();
  if (!/^\d{4,6}$/.test(value)) return "PIN must be 4–6 digits";
  return null;
}

export async function createPinRecord(email: string, pin: string): Promise<StoredPin> {
  const err = validatePinInput(pin);
  if (err) throw new Error(err);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePinHash(pin, salt);
  return { email: email.toLowerCase(), hash, salt: bufferToHex(salt) };
}

export async function verifyPin(email: string, pin: string, record: StoredPin): Promise<boolean> {
  if (record.email !== email.toLowerCase()) return false;
  const salt = Uint8Array.from(record.salt.match(/.{1,2}/g)!.map((h) => parseInt(h, 16)));
  const hash = await derivePinHash(pin, salt);
  return hash === record.hash;
}

export function loadLocalPinRecord(): StoredPin | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPin;
    if (!parsed?.email || !parsed?.hash || !parsed?.salt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalPinRecord(record: StoredPin | null): void {
  if (!record) {
    localStorage.removeItem(LOCAL_KEY);
    return;
  }
  localStorage.setItem(LOCAL_KEY, JSON.stringify(record));
}

export function isPinUnlockSession(): boolean {
  return sessionStorage.getItem(UNLOCK_KEY) === "1";
}

export function markPinUnlocked(): void {
  sessionStorage.setItem(UNLOCK_KEY, "1");
}

export function clearPinUnlockSession(): void {
  sessionStorage.removeItem(UNLOCK_KEY);
}

export function pinEnabledForEmail(email: string | null | undefined): boolean {
  const record = loadLocalPinRecord();
  return Boolean(record && email && record.email === email.toLowerCase());
}
