import { auth } from "./firebase";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function fetchTags() {
  const res = await fetch(`${API_BASE}/api/tags`, {
    headers: await authHeaders(),
  });
  const text = await res.text();
  let data: { tags?: string[]; error?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Tags API returned invalid JSON — is the dev server proxy running?");
  }
  if (!res.ok) throw new Error(data.error || "Failed to fetch tags");
  return data;
}

export type DeployRequest = {
  target_tag: string;
  publish_market: "Both" | "Open VSX" | "VS Code Marketplace";
  release_channel: "Production" | "Beta (Pre-release)";
};

export async function triggerDeployment(payload: DeployRequest) {
  const res = await fetch(`${API_BASE}/api/deploy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Deployment trigger failed");
  }

  return res.json();
}

/** @deprecated Use triggerDeployment with DeployRequest */
export async function triggerDeploymentLegacy(
  tag: string,
  _branch: string,
  channel: string,
  market: string
) {
  const publish_market =
    market === "both"
      ? "Both"
      : market === "open-vsx"
        ? "Open VSX"
        : "VS Code Marketplace";
  const release_channel = channel === "production" ? "Production" : "Beta (Pre-release)";
  return triggerDeployment({ target_tag: tag, publish_market, release_channel });
}
