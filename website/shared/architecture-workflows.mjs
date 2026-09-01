/**
 * Glowing workflow graphs for the marketing site architecture section.
 * Mermaid sources remain in architecture-diagrams.mjs for README / admin.
 * Node labels align with architecture-workflow-from-mermaid.mjs coverage checks.
 */

/** @typedef {'blue' | 'purple' | 'teal' | 'green' | 'amber'} WorkflowTone */

/**
 * @typedef {object} WorkflowNode
 * @property {string} id
 * @property {string} label
 * @property {string} [sub]
 * @property {string} icon
 * @property {WorkflowTone} tone
 */

/**
 * @typedef {object} WorkflowEdge
 * @property {string} from
 * @property {string} to
 * @property {boolean} [dashed]
 * @property {boolean} [feedback]
 */

/**
 * @typedef {object} WorkflowView
 * @property {string} label
 * @property {string} ariaLabel
 * @property {WorkflowNode[][]} rows
 * @property {WorkflowEdge[]} edges
 * @property {{ title: string; items: string[] }} [sidebar]
 * @property {string[]} [simulationPath]
 */

/** @type {Record<string, WorkflowView>} */
export const ARCHITECTURE_WORKFLOWS = {
  dataFlow: {
    label: "Data flow",
    ariaLabel:
      "Data flow: clients, local extensions, Cursor API, security scan, GitHub Pages, and Mission Control",
    rows: [
      [
        { id: "ide", label: "Cursor / VS Code", sub: "Windsurf · VSCodium", icon: "monitor", tone: "blue" },
        { id: "browser", label: "Firefox / Chrome", sub: "Browser clients", icon: "monitor", tone: "blue" },
        { id: "visitor", label: "Website visitor", sub: "Public marketing", icon: "globe", tone: "teal" },
        { id: "operator", label: "Mission Control operator", sub: "Admin user", icon: "user", tone: "purple" },
      ],
      [
        { id: "ext", label: "IDE Extension", sub: "Quota + credential scan", icon: "puzzle", tone: "purple" },
        { id: "bext", label: "Browser extension", sub: "Popup + options", icon: "puzzle", tone: "purple" },
      ],
      [
        { id: "db", label: "state.vscdb", sub: "Local SQLite", icon: "database", tone: "purple" },
        { id: "scan", label: "scanSecrets", sub: "Shared scanner", icon: "shield", tone: "green" },
        { id: "alert", label: "Security alert UI", sub: "Leak warnings", icon: "alert", tone: "amber" },
      ],
      [
        { id: "api", label: "api2.cursor.sh", sub: "Cursor API", icon: "cloud", tone: "blue" },
        { id: "githook", label: "pre-commit secretlint", sub: "Git hook guard", icon: "git", tone: "green" },
      ],
      [
        { id: "site", label: "GitHub Pages", sub: "Marketing site", icon: "globe", tone: "teal" },
        { id: "mc", label: "Mission Control SPA", sub: "Admin dashboard", icon: "rocket", tone: "blue" },
      ],
      [
        { id: "fn", label: "Pages Functions /api/*", sub: "Edge API", icon: "server", tone: "purple" },
        { id: "kv", label: "ADMIN_KV", sub: "Settings + cache", icon: "database", tone: "purple" },
        { id: "gha", label: "GitHub Actions dispatch", sub: "Deploy triggers", icon: "workflow", tone: "teal" },
      ],
    ],
    edges: [
      { from: "ide", to: "ext" },
      { from: "browser", to: "bext" },
      { from: "ext", to: "db" },
      { from: "ext", to: "api" },
      { from: "bext", to: "api" },
      { from: "ext", to: "scan" },
      { from: "bext", to: "scan" },
      { from: "scan", to: "alert" },
      { from: "githook", to: "scan" },
      { from: "visitor", to: "site" },
      { from: "operator", to: "mc" },
      { from: "mc", to: "fn" },
      { from: "fn", to: "kv" },
      { from: "fn", to: "gha" },
      { from: "db", to: "local", dashed: true, feedback: true },
      { from: "local", to: "ext", dashed: true, feedback: true },
    ],
    sidebar: {
      title: "Local — private",
      items: ["state.vscdb", "Usage cache", "Budget cap", "No cloud telemetry"],
    },
    simulationPath: ["ide", "ext", "scan", "api", "db", "alert", "visitor", "site", "operator", "mc", "fn", "kv"],
  },

  deployPipeline: {
    label: "Production Deployment",
    ariaLabel:
      "Production deployment: CI, version sync, marketplaces, Cloudflare admin, GitHub Pages, Discord notify",
    rows: [
      [
        { id: "pushmain", label: "Push to main", sub: "CI + tag prep", icon: "git", tone: "blue" },
        { id: "mcdeploy", label: "Mission Control Deploy", sub: "Manual dispatch", icon: "user", tone: "purple" },
        { id: "mcrollback", label: "Rollback", sub: "Mission Control", icon: "refresh", tone: "amber" },
        { id: "mcinfra", label: "deploy-infra", sub: "Admin + site", icon: "server", tone: "teal" },
        { id: "mctag", label: "publish-tag / full-release", sub: "Marketplace push", icon: "package", tone: "green" },
      ],
      [
        { id: "ci", label: "CI: compile, test, VSIX, browser-ext, admin", sub: "Quality gate", icon: "clipboard", tone: "purple" },
        { id: "tagprep", label: "prepare-tag", sub: "max live + patch", icon: "brain", tone: "teal" },
        { id: "releaseprep", label: "release-prep", sub: "version:sync", icon: "refresh", tone: "teal" },
      ],
      [
        { id: "market", label: "deploy: OVSX, VS Code, AMO, Chrome zip", sub: "Marketplaces job", icon: "package", tone: "green" },
        { id: "adminjob", label: "admin-deploy: Cloudflare Pages", sub: "Mission Control", icon: "rocket", tone: "blue" },
        { id: "webjob", label: "website: GitHub Pages", sub: "Marketing deploy", icon: "globe", tone: "teal" },
        { id: "seojob", label: "seo-pipeline: site-data + SEO PR", sub: "Weekly artifacts", icon: "chart", tone: "purple" },
      ],
      [
        { id: "ovsx", label: "Open VSX lorapok-labs", sub: "Canonical listing", icon: "package", tone: "green" },
        { id: "ovsxdup", label: "Open VSX LorapokLabs dup", sub: "Legacy namespace", icon: "package", tone: "amber" },
        { id: "vsm", label: "VS Code Marketplace", sub: "VSCE publish", icon: "monitor", tone: "blue" },
        { id: "amo", label: "Firefox AMO", sub: "web-ext sign", icon: "shield", tone: "green" },
      ],
      [
        { id: "chromezip", label: "Chrome zip artifact", sub: "Direct download", icon: "download", tone: "teal" },
        { id: "ghrel", label: "GitHub Release VSIX", sub: "Tagged asset", icon: "git", tone: "blue" },
        { id: "cf", label: "Cloudflare Pages + Functions", sub: "Mission Control", icon: "server", tone: "purple" },
      ],
      [
        { id: "mail", label: "Cloudflare Email", sub: "Outbound mail", icon: "mail", tone: "teal" },
        { id: "kv", label: "ADMIN_KV", sub: "Admin bindings", icon: "database", tone: "purple" },
        { id: "discordn", label: "Discord webhook notify", sub: "Deploy events", icon: "message", tone: "teal" },
      ],
      [{ id: "syncovsx", label: "sync-open-vsx: dual namespace", sub: "Drift retry", icon: "refresh", tone: "amber" }],
      [{ id: "ovsxlag", label: "Canonical OVSX indexing lag", sub: "Marketplace delay", icon: "clock", tone: "amber" }],
    ],
    edges: [
      { from: "pushmain", to: "ci" },
      { from: "pushmain", to: "tagprep" },
      { from: "tagprep", to: "releaseprep" },
      { from: "mcdeploy", to: "market" },
      { from: "mcrollback", to: "market" },
      { from: "mctag", to: "market" },
      { from: "mcinfra", to: "adminjob" },
      { from: "mcinfra", to: "webjob" },
      { from: "ci", to: "market" },
      { from: "releaseprep", to: "market" },
      { from: "market", to: "ovsx" },
      { from: "market", to: "ovsxdup" },
      { from: "market", to: "vsm" },
      { from: "market", to: "amo" },
      { from: "market", to: "chromezip" },
      { from: "market", to: "ghrel" },
      { from: "adminjob", to: "cf" },
      { from: "cf", to: "mail" },
      { from: "cf", to: "kv" },
      { from: "market", to: "discordn" },
      { from: "adminjob", to: "discordn" },
      { from: "webjob", to: "discordn" },
      { from: "seojob", to: "webjob", dashed: true },
      { from: "ovsxdup", to: "syncovsx", dashed: true, feedback: true },
      { from: "ovsxlag", to: "syncovsx", dashed: true, feedback: true },
      { from: "syncovsx", to: "ovsx", dashed: true, feedback: true },
    ],
    sidebar: {
      title: "Release artifacts",
      items: ["VSIX package", "site-data.json", "Chrome zip", "SEO manifest"],
    },
    simulationPath: ["pushmain", "ci", "tagprep", "releaseprep", "market", "ovsx", "adminjob", "cf", "discordn"],
  },

  edgeCases: {
    label: "Edge cases & guards",
    ariaLabel: "Edge cases: auth boundaries, version guards, runtime limits, safe release",
    rows: [
      [
        { id: "master", label: "Master admin only dispatch", sub: "Deploy gate", icon: "lock", tone: "blue" },
        { id: "firebase", label: "Firebase Auth + Firestore admins", sub: "Operator login", icon: "shield", tone: "purple" },
        { id: "kvsync", label: "ADMIN_KV team sync", sub: "ACL mirror", icon: "database", tone: "purple" },
      ],
      [
        { id: "unified", label: "assertUnifiedVersion site-data", sub: "Semver guard", icon: "brain", tone: "teal" },
        { id: "dualns", label: "Dual Open VSX max semver", sub: "Namespace parity", icon: "refresh", tone: "green" },
        { id: "liveblock", label: "Deploy blocked if tag is live", sub: "No downgrade", icon: "alert", tone: "amber" },
      ],
      [
        { id: "ovsxverify", label: "publish-ovsx fails if API lags", sub: "Indexing wait", icon: "clock", tone: "amber" },
        { id: "betafilter", label: "Beta channel hides CI-only tags", sub: "Channel filter", icon: "sliders", tone: "teal" },
      ],
      [
        { id: "dbquit", label: "DB writes need editor quit", sub: "SQLite safety", icon: "database", tone: "purple" },
        { id: "nochat", label: "Composer chat secrets not on disk", sub: "No chat bodies on disk", icon: "shield", tone: "green" },
        { id: "scanscope", label: "scanSecrets file scope", sub: "Local file scan only", icon: "shield", tone: "green" },
        { id: "mailpush", label: "Push main skips mail repair", sub: "Mail repair deferred", icon: "mail", tone: "teal" },
        { id: "fastdeploy", label: "Fast admin deploy path", sub: "Skip mail on main push", icon: "rocket", tone: "teal" },
        { id: "conterr", label: "admin-deploy continue-on-error Pages", sub: "Resilient deploy", icon: "server", tone: "blue" },
      ],
      [
        { id: "mcform", label: "Deployments form", sub: "Mission Control UI", icon: "clipboard", tone: "blue" },
        { id: "api403", label: "403 without KV sync", sub: "Auth failure", icon: "alert", tone: "amber" },
        { id: "webdeploy", label: "Marketing site job", sub: "Pages publish", icon: "globe", tone: "teal" },
      ],
      [
        { id: "syncwf", label: "sync-open-vsx retry", sub: "Drift recovery", icon: "refresh", tone: "green" },
        { id: "fallback", label: "Composer 2.5 fallback", sub: "Free model path", icon: "brain", tone: "teal" },
        { id: "warndiscord", label: "Discord failure card", sub: "Ops visibility", icon: "message", tone: "purple" },
      ],
    ],
    edges: [
      { from: "master", to: "mcform" },
      { from: "firebase", to: "mcform" },
      { from: "kvsync", to: "api403" },
      { from: "unified", to: "webdeploy" },
      { from: "dualns", to: "unified" },
      { from: "ovsxverify", to: "syncwf" },
      { from: "liveblock", to: "mcform" },
      { from: "betafilter", to: "mcform" },
      { from: "dbquit", to: "fallback" },
      { from: "nochat", to: "scanscope", dashed: true },
      { from: "scanscope", to: "fallback", dashed: true },
      { from: "mailpush", to: "fastdeploy", dashed: true },
      { from: "fastdeploy", to: "mcform", dashed: true },
      { from: "conterr", to: "warndiscord" },
      { from: "policy", to: "master", dashed: true, feedback: true },
      { from: "mcform", to: "policy", dashed: true, feedback: true },
    ],
    sidebar: {
      title: "Policy",
      items: ["403 without KV sync", "Beta channel filter", "OVSX verify retry"],
    },
    simulationPath: ["master", "firebase", "unified", "dualns", "dbquit", "mcform", "syncwf", "warndiscord"],
  },

  scheduledOps: {
    label: "Schedules & Discord",
    ariaLabel: "Scheduled operations: cron worker, stats refresh, KV cache, Discord digest and webhooks",
    rows: [
      [
        { id: "croncfg", label: "Cron schedules · stats refresh + Discord digest", sub: "Mission Control Settings", icon: "sliders", tone: "blue" },
        { id: "discordcfg", label: "Discord webhooks · deployment + feedback", sub: "Settings KV", icon: "message", tone: "purple" },
        { id: "mc", label: "Operator", sub: "Manual refresh + digest", icon: "user", tone: "blue" },
      ],
      [
        { id: "seo", label: "seo-pipeline · Mon 06:00 UTC", sub: "GitHub Actions schedule", icon: "chart", tone: "green" },
        { id: "depsec", label: "dependency-security · Mon 07:30 UTC", sub: "GitHub Actions schedule", icon: "shield", tone: "amber" },
        { id: "artifacts", label: "site-data.json · SEO · badges · sitemap", sub: "Committed artifacts", icon: "package", tone: "teal" },
      ],
      [
        { id: "worker", label: "ccm-stats-cron worker · every minute", sub: "Cloudflare cron", icon: "clock", tone: "purple" },
        { id: "cronstats", label: "POST /api/cron/stats-refresh", sub: "Interval gate", icon: "server", tone: "blue" },
        { id: "crondigest", label: "POST /api/cron/discord-digest", sub: "Interval gate", icon: "message", tone: "teal" },
      ],
      [
        { id: "refresh", label: "runStatsRefresh", sub: "Live download stats", icon: "refresh", tone: "green" },
        { id: "digest", label: "runDiscordDigest · download breakdown", sub: "Discord notifications", icon: "chart", tone: "teal" },
      ],
      [
        { id: "kv", label: "ADMIN_KV", sub: "Live cache store", icon: "database", tone: "purple" },
        { id: "cache", label: "stats:live-cache", sub: "KV overlay", icon: "database", tone: "purple" },
        { id: "pages", label: "Pages Functions /api/*", sub: "Public API", icon: "server", tone: "blue" },
      ],
      [
        { id: "public", label: "GET /api/site-data · badge.json", sub: "Hero + README", icon: "send", tone: "teal" },
        { id: "deployevt", label: "Deploy started / completed watch", sub: "Live status", icon: "rocket", tone: "blue" },
        { id: "cinotify", label: "CI discord-deployment-notify.mjs", sub: "Workflow hook", icon: "workflow", tone: "green" },
      ],
      [
        { id: "feedback", label: "Feedback webhook test", sub: "Settings probe", icon: "message", tone: "amber" },
        { id: "webhook", label: "deploymentWebhookUrl", sub: "Outbound only", icon: "send", tone: "teal" },
        { id: "feedbackhook", label: "feedbackWebhookUrl", sub: "Community channel", icon: "message", tone: "purple" },
      ],
    ],
    edges: [
      { from: "croncfg", to: "worker", dashed: true },
      { from: "croncfg", to: "cronstats", dashed: true },
      { from: "croncfg", to: "crondigest", dashed: true },
      { from: "discordcfg", to: "webhook" },
      { from: "discordcfg", to: "feedbackhook" },
      { from: "seo", to: "artifacts" },
      { from: "worker", to: "cronstats" },
      { from: "worker", to: "crondigest" },
      { from: "cronstats", to: "refresh" },
      { from: "crondigest", to: "digest" },
      { from: "refresh", to: "kv" },
      { from: "refresh", to: "cache" },
      { from: "cache", to: "public" },
      { from: "pages", to: "kv" },
      { from: "digest", to: "webhook" },
      { from: "deployevt", to: "webhook" },
      { from: "cinotify", to: "webhook" },
      { from: "feedback", to: "feedbackhook" },
      { from: "mc", to: "croncfg", dashed: true, feedback: true },
      { from: "mc", to: "refresh", dashed: true, feedback: true },
      { from: "schedules", to: "croncfg", dashed: true, feedback: true },
    ],
    sidebar: {
      title: "Schedules",
      items: ["SEO Mon 06:00 UTC", "Dep security Mon 07:30", "Minute cron gate"],
    },
    simulationPath: ["croncfg", "worker", "cronstats", "refresh", "cache", "public", "crondigest", "digest", "webhook"],
  },
};

/** Inline SVG icon paths (24×24 viewBox) */
export const WORKFLOW_ICONS = {
  monitor:
    '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  puzzle:
    '<path d="M19.439 7.85c-.57.57-.85 1.28-.85 2.12 0 .84.28 1.55.85 2.12.57.57 1.28.85 2.12.85h.01v3.01c0 .84-.28 1.55-.85 2.12-.57.57-1.28.85-2.12.85H16.5v-2.5c0-.84-.28-1.55-.85-2.12-.57-.57-1.28-.85-2.12-.85s-1.55.28-2.12.85c-.57.57-.85 1.28-.85 2.12V19H7.44c-.84 0-1.55-.28-2.12-.85-.57-.57-.85-1.28-.85-2.12V13.9h.01c.84 0 1.55-.28 2.12-.85.57-.57.85-1.28.85-2.12s-.28-1.55-.85-2.12c-.57-.57-1.28-.85-2.12-.85H4.5V5.44c0-.84.28-1.55.85-2.12.57-.57 1.28-.85 2.12-.85H9.5v2.5c0 .84.28 1.55.85 2.12.57.57 1.28.85 2.12.85s1.55-.28 2.12-.85c.57-.57.85-1.28.85-2.12V2.5h3.01c.84 0 1.55.28 2.12.85.57.57.85 1.28.85 2.12v3.01h-.01c-.84 0-1.55.28-2.12.85z"/>',
  brain:
    '<path d="M9.5 2A5.5 5.5 0 0 0 4 7.5c0 .83.19 1.61.52 2.31A4.5 4.5 0 0 0 3 14c0 2.21 1.79 4 4 4 .55 0 1.08-.11 1.56-.32A5.5 5.5 0 0 0 14.5 22 5.5 5.5 0 0 0 20 16.5a4.5 4.5 0 0 0-.52-2.19A5.5 5.5 0 0 0 14.5 2 5.5 5.5 0 0 0 9.5 2z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  cloud:
    '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  database:
    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  clipboard:
    '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
  package:
    '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  rocket:
    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  refresh:
    '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  mail:
    '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  sliders:
    '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  clock:
    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  chart:
    '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  message:
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  server:
    '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  git:
    '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>',
  workflow:
    '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><path d="M10 7h4M17 10v4M10 17h4"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
};

export const ARCHITECTURE_WORKFLOW_KEYS = Object.keys(ARCHITECTURE_WORKFLOWS);
