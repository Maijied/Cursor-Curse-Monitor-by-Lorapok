import * as crypto from "crypto";

/**
 * Escapes special characters for safe insertion into HTML strings.
 */
export function escapeHtml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Formats a numeric USD amount as a currency string ($0.00).
 */
export function money(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

/**
 * Formats a decimal feature percentage (up to 2 decimal places).
 */
export function formatFeaturePercent(n: number): string {
  if (!Number.isFinite(n)) {
    return "0";
  }
  return String(Math.round(n * 100) / 100);
}

/**
 * Generates a cryptographically random nonce for Content-Security-Policy.
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString("base64");
}
