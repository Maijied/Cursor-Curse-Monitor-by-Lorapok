/**
 * Canonical Mermaid sources for README, marketing site, and Mission Control.
 * Keep diagrams in sync — corner cases and deploy paths documented here.
 */

/** @type {Record<string, { label: string; description: string; diagram: string }>} */
export const ARCHITECTURE_VIEWS = {
  dataFlow: {
    label: "Data flow",
    description:
      "Local-first extension and browser surfaces. Credentials and usage never leave the machine except authenticated Cursor API calls.",
    diagram: `flowchart TB
  subgraph clients["Clients"]
    IDE["Cursor / VS Code / Windsurf / VSCodium"]
    Browser["Firefox / Chrome"]
    Visitor["Website visitor"]
    Operator["Mission Control operator"]
  end

  subgraph local["Local — private"]
    EXT["IDE Extension"]
    DB[("state.vscdb")]
    BEXT["Browser extension"]
    SCAN["scanSecrets shared"]
    ALERT["Security alert UI"]
  end

  subgraph cursor["Cursor API"]
    API["api2.cursor.sh"]
  end

  IDE --> EXT
  EXT --> DB
  EXT --> API
  Browser --> BEXT
  BEXT --> API
  EXT --> SCAN
  BEXT --> SCAN
  SCAN --> ALERT
  GitHook["pre-commit secretlint"] --> SCAN

  Visitor --> SITE["GitHub Pages"]
  Operator --> MC["Mission Control SPA"]
  MC --> FN["Pages Functions /api/*"]
  FN --> KV[("ADMIN_KV")]
  FN --> GHA["GitHub Actions dispatch"]`,
  },

  deployPipeline: {
    label: "Production Deployment",
    description:
      "Single workflow (ci-cd.yml): CI on PR/push, tag prep on main, manual marketplace publish, infra deploy, and Discord notifications.",
    diagram: `flowchart TB
  subgraph triggers["Triggers"]
    PushMain["Push to main"]
    MCDeploy["Mission Control Deploy"]
    MCRollback["Rollback"]
    MCInfra["deploy-infra"]
    MCTag["publish-tag / full-release"]
  end

  subgraph gha["Production Deployment workflow"]
    CI["CI: compile, test, VSIX, browser-ext, admin"]
    TagPrep["prepare-tag: max live + patch"]
    ReleasePrep["release-prep: version:sync"]
    Market["deploy: OVSX, VS Code, AMO, Chrome zip"]
    AdminJob["admin-deploy: Cloudflare Pages"]
    WebJob["website: GitHub Pages"]
    SEOJob["seo-pipeline: site-data + SEO PR"]
    SyncOVSX["sync-open-vsx: dual namespace"]
    DiscordN["Discord webhook notify"]
  end

  PushMain --> CI
  PushMain --> TagPrep
  TagPrep --> ReleasePrep
  MCDeploy --> Market
  MCRollback --> Market
  MCTag --> Market
  MCInfra --> AdminJob
  MCInfra --> WebJob

  Market --> OVSX["Open VSX lorapok-labs"]
  Market --> OVSXDup["Open VSX LorapokLabs dup"]
  Market --> VSM["VS Code Marketplace"]
  Market --> AMO["Firefox AMO web-ext sign"]
  Market --> ChromeZip["Chrome zip artifact"]
  Market --> GHRel["GitHub Release VSIX"]

  AdminJob --> CF["Cloudflare Pages + Functions"]
  CF --> Mail["Cloudflare Email"]
  CF --> KV[("ADMIN_KV")]

  Market --> DiscordN
  AdminJob --> DiscordN
  WebJob --> DiscordN
  OVSXLag["Canonical OVSX indexing lag"] -.-> SyncOVSX
  SyncOVSX --> OVSX`,
  },

  edgeCases: {
    label: "Edge cases & guards",
    description:
      "Failure modes, auth boundaries, and version guards that keep releases safe when marketplaces drift or APIs lag.",
    diagram: `flowchart LR
  subgraph auth["Access control"]
    Master["Master admin only dispatch"]
    Firebase["Firebase Auth + Firestore admins"]
    KVSync["ADMIN_KV team sync"]
  end

  subgraph version["Version guards"]
    Unified["assertUnifiedVersion site-data"]
    DualNS["Dual Open VSX max semver"]
    LiveBlock["Deploy blocked if tag is live"]
    OVSXVerify["publish-ovsx fails if API lags CLI"]
    BetaFilter["Beta channel hides CI-only tags"]
  end

  subgraph runtime["Runtime limits"]
    DBQuit["DB writes need editor quit"]
    NoChat["Composer chat secrets not on disk"]
    MailPush["Push main skips mail repair"]
    ContErr["admin-deploy continue-on-error Pages"]
  end

  Master --> MCForm["Deployments form"]
  Firebase --> MCForm
  KVSync --> API403["403 without KV sync"]
  Unified --> WebDeploy["Marketing site job"]
  DualNS --> Unified
  OVSXVerify --> SyncWF["sync-open-vsx retry"]
  LiveBlock --> MCForm
  BetaFilter --> MCForm
  DBQuit --> Fallback["Composer 2.5 fallback"]
  NoChat --> ScanScope["scanSecrets file scope"]
  MailPush --> FastDeploy["Fast admin deploy path"]
  ContErr --> WarnDiscord["Discord failure card"]`,
  },
};

/** Simplified diagram for GitHub README rendering */
export const README_ARCHITECTURE_DIAGRAM = `flowchart LR
  IDE["Cursor / VS Code"] -->|local token| EXT["IDE Extension"]
  EXT -->|usage + billing| API["api2.cursor.sh"]
  EXT --> SCAN["scanSecrets"]
  Browser["Firefox / Chrome"] --> BEXT["Browser ext"]
  BEXT --> API
  BEXT --> SCAN
  SCAN --> ALERT["Security alerts"]
  GitHook["pre-commit"] --> SCAN

  Visitor["Visitor"] --> SITE["GitHub Pages"]
  Operator["Admin"] --> MC["Mission Control"]
  MC -->|dispatch| GHA["Production Deployment"]
  MC --> KV[("ADMIN_KV")]
  GHA --> OVSX["Open VSX"]
  GHA --> VSM["VS Code Marketplace"]
  GHA --> AMO["Firefox AMO"]
  GHA --> CHROME["Chrome zip"]
  GHA --> Pages["Admin + marketing deploy"]`;

export const ARCHITECTURE_VIEW_KEYS = Object.keys(ARCHITECTURE_VIEWS);
