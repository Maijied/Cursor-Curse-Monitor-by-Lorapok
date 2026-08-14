import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(rootDir, "../..");
const visitorStatsPath = resolve(repoRoot, "website/visitor-stats.json");
const GITHUB_REPO = "Maijied/Cursor-Curse-Monitor-by-Lorapok";

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

async function fetchGitHubTags() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=30`, {
    headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "cursor-usage-monitor-dev" },
  });
  if (!res.ok) throw new Error(`GitHub tags ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map((t) => t.name).filter(Boolean) : [];
}

async function fetchDiscussions() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/discussions?per_page=10`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "cursor-usage-monitor-dev" },
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
    { headers: { Accept: "application/vnd.github+json", "User-Agent": "cursor-usage-monitor-dev" } }
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
        .then((tags) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ tags }));
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

    next();
  };
}
