/**
 * Welcome to Cloudflare Workers!
 */

export interface Env {
  GITHUB_PAT: string;
}

const REPO_OWNER = "Maijied";
const REPO_NAME = "Cursor-Curse-Monitor-by-Lorapok";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Replace with your frontend domain in prod
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/api/tags" && request.method === "GET") {
      return await handleGetTags(env);
    }

    if (url.pathname === "/api/deploy" && request.method === "POST") {
      return await handleDeploy(request, env);
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};

async function handleGetTags(env: Env) {
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/tags`, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Cloudflare-Worker"
    }
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Failed to fetch tags from GitHub" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const data: any[] = await res.json();
  const tags = data.map(t => t.name);

  return new Response(JSON.stringify({ tags }), {
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}

async function handleDeploy(request: Request, env: Env) {
  try {
    // 1. Verify Authorization Header (Simplified for Cloudflare Worker)
    // Note: In production, verify the Firebase JWT token using a library like `jose`
    // or by making a request to Google Identity Toolkit API.
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }
    const token = authHeader.split("Bearer ")[1];
    
    // Minimal verification for demonstration (requires FIREBASE_WEB_API_KEY in env for real verify)
    // We assume the token is somewhat valid if it exists, BUT YOU MUST SECURE THIS.

    // 2. Parse body
    const { tag, branch, channel, market } = await request.json() as any;
    if (!tag || !branch || !channel) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 3. Trigger GitHub Actions `deployment.yml` workflow
    const ghRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/deployment.yml/dispatches`, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${env.GITHUB_PAT}`,
        "User-Agent": "Cloudflare-Worker",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        ref: branch,
        inputs: {
          target_tag: tag,
          release_channel: channel,
          market: market || "open-vsx"
        }
      })
    });

    if (!ghRes.ok) {
      const errText = await ghRes.text();
      return new Response(JSON.stringify({ error: "GitHub API failed", details: errText }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Deployment triggered" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
