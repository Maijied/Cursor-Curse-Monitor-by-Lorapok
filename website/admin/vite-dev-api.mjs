import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(rootDir, "../..");
const visitorStatsPath = resolve(repoRoot, "website/visitor-stats.json");
const GITHUB_REPO = "Maijied/Cursor-Curse-Monitor-by-Lorapok";
const siteDataPath = resolve(repoRoot, "website/site-data.json");

function loadGithubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const envPath = resolve(rootDir, ".env");
  if (!existsSync(envPath)) return null;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^GITHUB_TOKEN=(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

function githubHeaders() {
  const token = loadGithubToken();
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "cursor-usage-monitor-dev",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

function readCachedTags() {
  try {
    const data = JSON.parse(readFileSync(siteDataPath, "utf8"));
    if (Array.isArray(data.github?.tags) && data.github.tags.length > 0) {
      return data.github.tags;
    }
    if (data.github?.releaseTag) return [data.github.releaseTag];
    if (data.packageVersion) return [`v${String(data.packageVersion).replace(/^v/, "")}`];
  } catch {
    /* ignore */
  }
  return [];
}

async function fetchGitHubTags() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=30`, {
    headers: githubHeaders(),
  });
  if (res.ok) {
    const data = await res.json();
    return {
      tags: Array.isArray(data) ? data.map((t) => t.name).filter(Boolean) : [],
      source: "github",
    };
  }
  const cached = readCachedTags();
  if (cached.length > 0) {
    const msg = res.status === 403
      ? "GitHub API rate limit — using cached tags from site-data.json. Add GITHUB_TOKEN to website/admin/.env"
      : `GitHub tags ${res.status} — using cached tags from site-data.json`;
    return { tags: cached, source: "cache", warning: msg };
  }
  if (res.status === 403) {
    throw new Error("GitHub API rate limit exceeded. Add GITHUB_TOKEN to website/admin/.env and restart npm run dev.");
  }
  throw new Error(`GitHub tags ${res.status}`);
}

const DEFAULT_STATS = {
  websiteVisits: 0,
  packageClicks: { ovsx: 0, vscode: 0, github: 0, vsix: 0, openvsxDuplicate: 0 },
  totalEngagement: 0,
  updatedAt: null,
};

function readStats() {
  if (!existsSync(visitorStatsPath)) return { ...DEFAULT_STATS, packageClicks: { ...DEFAULT_STATS.packageClicks } };
  try {
    return JSON.parse(readFileSync(visitorStatsPath, "utf8"));
  } catch {
    return { ...DEFAULT_STATS, packageClicks: { ...DEFAULT_STATS.packageClicks } };
  }
}

function writeStats(stats) {
  writeFileSync(visitorStatsPath, JSON.stringify(stats, null, 2) + "\n");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function incrementStats(channel) {
  const stats = readStats();
  if (!stats.packageClicks) stats.packageClicks = { ...DEFAULT_STATS.packageClicks };

  if (channel === "website") {
    stats.websiteVisits = (stats.websiteVisits ?? 0) + 1;
  } else if (channel in stats.packageClicks) {
    stats.packageClicks[channel] = (stats.packageClicks[channel] ?? 0) + 1;
  } else if (channel === "openvsxDuplicate") {
    stats.packageClicks.openvsxDuplicate = (stats.packageClicks.openvsxDuplicate ?? 0) + 1;
  }

  stats.totalEngagement =
    (stats.websiteVisits ?? 0) +
    Object.values(stats.packageClicks).reduce((s, n) => s + (n ?? 0), 0);
  stats.updatedAt = new Date().toISOString();
  writeStats(stats);
  return stats;
}

async function fetchDiscussions() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/discussions?per_page=10`, {
    headers: githubHeaders(),
  });
  const enabled = res.ok;
  let discussions = [];
  if (enabled) {
    const data = await res.json();
    discussions = Array.isArray(data)
      ? data.map((d) => ({
          title: d.title,
          url: d.html_url,
          category: d.category?.name ?? "General",
          createdAt: d.created_at,
          comments: d.comments ?? 0,
        }))
      : [];
  }

  const issuesRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/issues?state=all&per_page=20&sort=updated`,
    { headers: githubHeaders() }
  );
  const topics = [];
  if (issuesRes.ok) {
    const issues = await issuesRes.json();
    const map = new Map();
    for (const issue of issues) {
      if (issue.pull_request) continue;
      const labels = (issue.labels ?? []).map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean);
      const topic = labels[0] ?? "General";
      if (!map.has(topic)) map.set(topic, { topic, count: 0, items: [] });
      const entry = map.get(topic);
      entry.count += 1;
      if (entry.items.length < 5) {
        entry.items.push({ title: issue.title, url: issue.html_url, state: issue.state });
      }
    }
    topics.push(...map.values());
  }

  return { enabled, discussions, topics, settingsUrl: `https://github.com/${GITHUB_REPO}/settings#features` };
}

async function fetchGitHubReleases() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`, {
    headers: githubHeaders(),
  });
  if (!res.ok) throw new Error(`GitHub releases ${res.status}`);
  const data = await res.json();
  return Array.isArray(data)
    ? data.map((r) => ({
        tag: r.tag_name,
        name: r.name,
        url: r.html_url,
        publishedAt: r.published_at,
        prerelease: r.prerelease,
        draft: r.draft,
        vsix: (r.assets ?? []).find((a) => a.name?.endsWith(".vsix")) ?? null,
      }))
    : [];
}

async function fetchWorkflowRuns() {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/runs?per_page=20&exclude_pull_requests=true`,
    { headers: githubHeaders() }
  );
  if (!res.ok) throw new Error(`GitHub runs ${res.status}`);
  const data = await res.json();
  return {
    runs: (data.workflow_runs ?? []).map((run) => ({
      id: run.id,
      name: run.name,
      workflow: run.path?.replace(/^\.github\/workflows\//, "") ?? run.name,
      status: run.status,
      conclusion: run.conclusion,
      url: run.html_url,
      branch: run.head_branch,
      event: run.event,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
    })),
    total: data.total_count ?? 0,
  };
}

async function fetchMarketplaceSync() {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  const name = pkg.name;
  const target = pkg.version.replace(/^v/, "");
  const fetchJson = async (url) => {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    return res.ok ? res.json() : null;
  };
  const [ovsxCanonical, ovsxDuplicate, githubRelease] = await Promise.all([
    fetchJson(`https://open-vsx.org/api/lorapok-labs/${name}`),
    fetchJson(`https://open-vsx.org/api/LorapokLabs/${name}`),
    fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`),
  ]);
  const channels = [
    { id: "github", label: "GitHub Release", version: githubRelease?.tag_name?.replace(/^v/, "") ?? null, synced: githubRelease?.tag_name?.replace(/^v/, "") === target },
    { id: "ovsx-canonical", label: "Open VSX (lorapok-labs)", version: ovsxCanonical?.version ?? null, downloadCount: ovsxCanonical?.downloadCount ?? 0, synced: ovsxCanonical?.version === target },
    { id: "ovsx-duplicate", label: "Open VSX duplicate", version: ovsxDuplicate?.version ?? null, downloadCount: ovsxDuplicate?.downloadCount ?? 0, synced: false, warn: true },
    { id: "package", label: "package.json", version: target, synced: true },
  ];
  return {
    packageVersion: target,
    syncStatus: channels.filter((c) => !c.warn).every((c) => c.synced) ? "synced" : "drift",
    channels,
    checkedAt: new Date().toISOString(),
  };
}

export function createDevApiMiddleware() {
  return (req, res, next) => {
    const url = req.url?.split("?")[0] ?? "";

    if (url === "/api/analytics/stats" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(readStats()));
      return;
    }

    if (url === "/api/analytics/visit" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const stats = incrementStats(parsed.channel || "website");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, stats }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid payload" }));
        }
      });
      return;
    }

    if (url === "/api/tags" && req.method === "GET") {
      fetchGitHubTags()
        .then((result) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/discussions" && req.method === "GET") {
      fetchDiscussions()
        .then((data) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/health" && req.method === "GET") {
      fetch("https://api.github.com/zen", { headers: githubHeaders() })
        .then((gh) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            ok: gh.ok,
            checks: { github: gh.ok, timestamp: new Date().toISOString() },
            firebaseProject: "cursor-curse-by-lorapok",
          }));
        });
      return;
    }

    if (url === "/api/releases" && req.method === "GET") {
      fetchGitHubReleases()
        .then((releases) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ releases }));
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/workflows/runs" && req.method === "GET") {
      fetchWorkflowRuns()
        .then((data) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/marketplace/sync" && req.method === "GET") {
      fetchMarketplaceSync()
        .then((data) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    next();
  };
}
