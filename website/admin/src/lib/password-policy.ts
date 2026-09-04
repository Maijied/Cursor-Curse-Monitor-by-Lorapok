/**
 * Client password policy for Mission Control invite-only accounts.
 * Min 12 chars + complexity; simple strength score (zxcvbn-style thresholds without extra deps).
 */

export type PasswordCheck = {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  label: "weak" | "fair" | "good" | "strong";
  errors: string[];
};

const MIN_LENGTH = 12;

export function validatePassword(password: string): PasswordCheck {
  const errors: string[] = [];
  const value = password ?? "";

  if (value.length < MIN_LENGTH) {
    errors.push(`At least ${MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(value)) errors.push("One lowercase letter");
  if (!/[A-Z]/.test(value)) errors.push("One uppercase letter");
  if (!/\d/.test(value)) errors.push("One number");
  if (!/[^A-Za-z0-9]/.test(value)) errors.push("One symbol");

  let score: PasswordCheck["score"] = 0;
  if (value.length >= MIN_LENGTH) score = 1;
  if (errors.length === 0) score = 2;
  if (errors.length === 0 && value.length >= 14) score = 3;
  if (errors.length === 0 && value.length >= 16 && !/password|123456|qwerty/i.test(value)) score = 4;

  const label: PasswordCheck["label"] =
    score <= 1 ? "weak" : score === 2 ? "fair" : score === 3 ? "good" : "strong";

  return { ok: errors.length === 0, score, label, errors };
}

export function passwordStrengthColor(score: PasswordCheck["score"]): string {
  if (score <= 1) return "var(--color-danger)";
  if (score === 2) return "#f59e0b";
  if (score === 3) return "var(--color-accent-2)";
  return "var(--color-neon)";
}
