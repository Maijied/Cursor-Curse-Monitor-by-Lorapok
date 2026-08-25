import { createRemoteJWKSet, jwtVerify } from "jose";
import { getAllowedAdminEmails, getMasterEmail } from "./admins.js";

const DEFAULT_PROJECT_ID = "cursor-curse-by-lorapok";
export const GITHUB_REPO = "Maijied/Cursor-Curse-Monitor-by-Lorapok";

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

export async function verifyAdminRequest(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "Missing or invalid Authorization header" }, 401) };
  }

  const token = authHeader.slice("Bearer ".length);
  const projectId = env.FIREBASE_PROJECT_ID ?? DEFAULT_PROJECT_ID;

  try {
    const JWKS = createRemoteJWKSet(
      new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
    );
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    if (!email) {
      return { error: jsonResponse({ error: "No email found in token" }, 403) };
    }

    const allowed = await getAllowedAdminEmails(env);
    if (!allowed.has(email)) {
      return { error: jsonResponse({ error: "Forbidden" }, 403) };
    }

    return { email, isMaster: email === getMasterEmail(env) };
  } catch {
    return { error: jsonResponse({ error: "Authentication failed" }, 401) };
  }
}

export function mapPublishMarket(value) {
  const map = {
    both: "Both",
    "open-vsx": "Open VSX",
    openvsx: "Open VSX",
    "vscode-marketplace": "VS Code Marketplace",
    vscode: "VS Code Marketplace",
    "firefox-amo": "Firefox AMO",
    "firefox": "Firefox AMO",
    Both: "Both",
    "Open VSX": "Open VSX",
    "VS Code Marketplace": "VS Code Marketplace",
    "Firefox AMO": "Firefox AMO",
  };
  return map[value] ?? null;
}

export function mapReleaseChannel(value) {
  const map = {
    beta: "Beta (Pre-release)",
    production: "Production",
    "Beta (Pre-release)": "Beta (Pre-release)",
    Production: "Production",
  };
  return map[value] ?? null;
}

export function requireMasterAdmin(auth) {
  if (!auth.isMaster) {
    return { error: jsonResponse({ error: "Master admin only" }, 403) };
  }
  return null;
}

export { jsonResponse };
