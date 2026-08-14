import { auth } from "./firebase";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export async function fetchTags() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE}/api/tags`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch tags");
  return res.json();
}

export async function triggerDeployment(tag: string, branch: string, channel: string, market: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  
  const token = await user.getIdToken();
  
  const res = await fetch(`${API_BASE}/api/deploy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ tag, branch, channel, market })
  });
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Deployment trigger failed");
  }
  
  return res.json();
}
