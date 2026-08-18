import { scanSecrets, type SecurityFinding } from "@lorapok/cursor-monitor-shared";

export function scanPasteField(
  text: string,
  location: string,
  allowCursorToken = false
): SecurityFinding[] {
  const findings = scanSecrets(text, {
    location,
    context: "paste",
    allowCursorToken,
  });
  const nonToken = findings.filter(
    (f) => f.kind !== "bearer_token" && f.kind !== "jwt"
  );
  if (nonToken.length > 0) return nonToken;
  if (!allowCursorToken && findings.length > 0) return findings;
  return [];
}
