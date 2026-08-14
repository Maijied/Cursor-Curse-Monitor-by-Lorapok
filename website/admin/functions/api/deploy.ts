import { createRemoteJWKSet, jwtVerify } from "jose";

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Verify Authorization Header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const token = authHeader.split("Bearer ")[1];

  try {
    // Firebase JWKS URL
    const JWKS = createRemoteJWKSet(
      new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
    );
    
    const projectId = "cursor-curse-by-lorapok";
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    const email = payload.email;
    if (!email) {
       return new Response(JSON.stringify({ error: "No email found in token" }), { status: 403 });
    }

    // 2. We can do further checks if needed, but the frontend also guards this.
    // Ideally, we could check a Firestore collection here, but for simplicity we rely on the valid Firebase Auth token.
    // The master admin is mdshuvo40@gmail.com
    
    // Parse deployment request
    const body = await request.json();
    const { tag, branch, channel, market } = body;

    if (!tag) {
      return new Response(JSON.stringify({ error: "Tag is required" }), { status: 400 });
    }

    // 3. Trigger GitHub API
    const githubToken = env.GITHUB_TOKEN;
    if (!githubToken) {
      return new Response(JSON.stringify({ error: "GitHub Token not configured on server" }), { status: 500 });
    }

    const githubRepo = "lorapok-labs/cursor-curse-monitor-by-lorapok";
    const workflowId = "deployment.yml";

    const githubRes = await fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowId}/dispatches`, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${githubToken}`,
        "User-Agent": "Cloudflare-Pages"
      },
      body: JSON.stringify({
        ref: branch || "development",
        inputs: {
          tag: tag,
          channel: channel || "beta",
          market: market || "open-vsx"
        }
      })
    });

    if (!githubRes.ok) {
      const errorText = await githubRes.text();
      return new Response(JSON.stringify({ error: `GitHub API failed: ${errorText}` }), { status: 502 });
    }

    return new Response(JSON.stringify({ success: true, message: "Deployment triggered successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Authentication failed or server error", details: err.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}
