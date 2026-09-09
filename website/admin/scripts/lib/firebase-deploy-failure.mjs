/**
 * Helpers for Firebase CLI deploy error reporting (used by sync-firebase-service-account-pages-secret.mjs).
 */

/** @param {string} text */
export function stripAnsi(text) {
  return String(text).replace(
    // eslint-disable-next-line no-control-regex
    /\u001b\[[0-9;]*m/g,
    ""
  );
}

/**
 * @param {string} line
 */
function isBenignFirebaseLine(line) {
  const plain = stripAnsi(line).trim();
  if (!plain) return true;
  if (/^npm warn/i.test(plain)) return true;
  if (/deprecated glob@/i.test(plain)) return true;
  if (/update to uuid@latest/i.test(plain)) return true;
  if (/checking .* for compilation errors/i.test(plain)) return true;
  if (/^i\s+cloud\.firestore:/i.test(plain)) return true;
  return false;
}

/**
 * @param {string} stdout
 * @param {string} stderr
 */
export function formatDeployFailure(stdout, stderr) {
  const combined = stripAnsi([stdout, stderr].filter(Boolean).join("\n")).trim();
  if (!combined) return "";

  const lines = combined.split(/\r?\n/);
  const signal = lines.find((line) => {
    const plain = stripAnsi(line).trim();
    if (isBenignFirebaseLine(plain)) return false;
    return (
      /(?:^|\s)(?:error|failed)\b/i.test(plain) ||
      /authentication error|permission denied|does not have permission|HTTP Error:/i.test(plain) ||
      /Compilation error/i.test(plain) ||
      /ENOENT/i.test(plain)
    );
  });
  if (signal) return signal.trim();

  const filtered = lines.map((line) => stripAnsi(line).trim()).filter((line) => line && !isBenignFirebaseLine(line));
  const tail = filtered.slice(-8).join("\n").trim();
  return tail || combined.slice(-800);
}
