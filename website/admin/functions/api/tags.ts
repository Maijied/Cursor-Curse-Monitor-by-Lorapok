export async function onRequestGet(context) {
  const { request, env } = context;

  // Verify auth header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
  }

  const githubToken = env.GITHUB_TOKEN;
  const githubRepo = "lorapok-labs/cursor-curse-monitor-by-lorapok";
  
  const res = await fetch(`https://api.github.com/repos/${githubRepo}/tags`, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      ...(githubToken && { "Authorization": `Bearer ${githubToken}` }),
      "User-Agent": "Cloudflare-Pages"
    }
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Failed to fetch tags from GitHub" }), { status: 502 });
  }

  const tags = await res.json();
  return new Response(JSON.stringify(tags), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
