export function githubHeaders(env) {
  const token = env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    ...(token && { Authorization: `Bearer ${token}` }),
    "User-Agent": "Cloudflare-Pages",
  };
}

export async function githubFetch(path, env, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...githubHeaders(env), ...(init.headers ?? {}) },
  });
  return res;
}
