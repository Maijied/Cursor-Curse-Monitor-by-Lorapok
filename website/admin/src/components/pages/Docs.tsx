import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";

const SECTIONS = [
  {
    id: "architecture",
    title: "Architecture",
    content: (
      <>
        <p>
          Cursor Curse Monitor is a VS Code / Cursor extension with three public surfaces and one private admin console.
          Understanding how they connect helps you deploy safely and debug sync issues.
        </p>
        <ul className="list-disc pl-5 space-y-2 mt-4">
          <li>
            <strong>Extension</strong> — TypeScript VS Code extension packaged as a VSIX. Published to Open VSX
            (canonical namespace <code className="font-[family-name:var(--font-mono)] text-sm">lorapok-labs</code>)
            and VS Code Marketplace (<code className="font-[family-name:var(--font-mono)] text-sm">LorapokLabs</code>).
          </li>
          <li>
            <strong>Marketing site</strong> — Static site in <code className="font-[family-name:var(--font-mono)] text-sm">website/</code>,
            deployed to GitHub Pages. Serves install commands, community links, and live <code className="font-[family-name:var(--font-mono)] text-sm">site-data.json</code>.
          </li>
          <li>
            <strong>Admin (Mission Control)</strong> — React SPA in <code className="font-[family-name:var(--font-mono)] text-sm">website/admin/</code>,
            deployed to Cloudflare Pages at <code className="font-[family-name:var(--font-mono)] text-sm">cursor-dev.lorapok.tech</code> with
            co-located Pages Functions under <code className="font-[family-name:var(--font-mono)] text-sm">functions/api/</code>.
          </li>
          <li>
            <strong>Lorapok Facility (Cloudflare)</strong> — Production account hosting the admin Pages project, KV for admin
            email sync, and DNS for <code className="font-[family-name:var(--font-mono)] text-sm">cursor-dev.lorapok.tech</code>.
            Do not deploy orphan Workers under other accounts.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "deploy-rollback",
    title: "Deploy & Rollback",
    content: (
      <>
        <p>
          Releases are driven by a single CI/CD workflow (<code className="font-[family-name:var(--font-mono)] text-sm">.github/workflows/ci-cd.yml</code>).
          Pushes to <code className="font-[family-name:var(--font-mono)] text-sm">main</code> run CI and deploy the website; marketplace publishing requires a manual workflow dispatch or tag push.
        </p>
        <h4 className="font-semibold mt-6 mb-2 text-[var(--color-text)]">Deploy (forward)</h4>
        <p>
          From the Deployments page, pick a target tag, publish market (Both / Open VSX / VS Code Marketplace), and release channel
          (Production or Beta). This dispatches the GitHub Actions deployment workflow with your inputs.
        </p>
        <h4 className="font-semibold mt-6 mb-2 text-[var(--color-text)]">Rollback</h4>
        <p>
          Rollback mode re-triggers the workflow against a <em>previous</em> tag to restore a known-good release across marketplaces.
          Use it when a new version causes regressions. A warning banner reminds you that rollback restores the selected tag version —
          verify marketplace sync on the Overview after completion.
        </p>
        <h4 className="font-semibold mt-6 mb-2 text-[var(--color-text)]">Local release</h4>
        <pre className="mt-2 p-4 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] text-sm font-[family-name:var(--font-mono)] overflow-x-auto">
{`npm run compile && npm run package
npm run publish:ovsx          # Open VSX (lorapok-labs)
npx vsce publish -p $VSCE_PAT # VS Code Marketplace`}
        </pre>
      </>
    ),
  },
  {
    id: "notices",
    title: "Notices",
    content: (
      <>
        <p>
          Site notices power the public development banner on the marketing site. The catalog lives in KV and is managed from
          the Notices page: generated marketing news is imported once, and admins can enable, disable, or delete any row.
          Public <code className="font-[family-name:var(--font-mono)] text-sm">GET /api/notice</code> returns the currently
          enabled item (one at a time). Admin list/create/update/delete uses{" "}
          <code className="font-[family-name:var(--font-mono)] text-sm">/api/notices</code>.
        </p>
        <p className="mt-4">
          Each notice has a title, short message (banner), full message, severity (info / warning / critical), dismissible flag,
          and optional feedback / collaborate URLs. Visitors who dismiss a notice won&apos;t see it again until the{" "}
          <code className="font-[family-name:var(--font-mono)] text-sm">updatedAt</code> timestamp changes. The marketing site
          falls back to <code className="font-[family-name:var(--font-mono)] text-sm">site-data.json</code> only when the live
          API is unreachable — a disabled catalog item will not keep showing the generated banner.
        </p>
      </>
    ),
  },
  {
    id: "analytics",
    title: "Analytics Channels",
    content: (
      <>
        <p>Visitor stats track engagement across the marketing site and install funnels:</p>
        <ul className="list-disc pl-5 space-y-2 mt-4">
          <li><strong>website</strong> — Page visits on GitHub Pages</li>
          <li><strong>ovsx</strong> — Clicks to Open VSX (lorapok-labs canonical listing)</li>
          <li><strong>vscode</strong> — VS Code Marketplace install link clicks</li>
          <li><strong>github</strong> — GitHub repo / release clicks</li>
          <li><strong>vsix</strong> — Direct VSIX download clicks</li>
          <li><strong>openvsxDuplicate</strong> — Legacy duplicate listing (deprecate)</li>
        </ul>
        <p className="mt-4">
          Live counts sync from Firestore <code className="font-[family-name:var(--font-mono)] text-sm">stats/visitors</code> when
          Firebase is reachable; otherwise the dashboard falls back to values in <code className="font-[family-name:var(--font-mono)] text-sm">site-data.json</code>.
        </p>
      </>
    ),
  },
  {
    id: "opt-in-heartbeat",
    title: "Opt-in heartbeat",
    content: (
      <>
        <p>
          When users enable anonymous usage reporting in the extension, a periodic heartbeat POSTs to{" "}
          <code className="font-[family-name:var(--font-mono)] text-sm">/api/usage/ping</code> with a stable install id,
          OS, and host editor — never Cursor tokens or chat content.
        </p>
        <p className="mt-4">
          Admin Overview dual KPIs combine these opt-in uniques with marketplace downloads and website visits from{" "}
          <code className="font-[family-name:var(--font-mono)] text-sm">/api/usage/stats</code>.
        </p>
      </>
    ),
  },
  {
    id: "quit-then-write",
    title: "Quit-then-write DB",
    content: (
      <>
        <p>
          Local usage snapshots are written on editor quit (or flush), not continuously streamed. The extension treats the
          on-disk store as read-mostly during sessions so crash recovery stays simple and private to the machine.
        </p>
      </>
    ),
  },
  {
    id: "discussions-github",
    title: "Discussion posts vs GitHub-only",
    content: (
      <>
        <p>
          Mission Control can <strong>create discussion posts</strong> via GraphQL when{" "}
          <code className="font-[family-name:var(--font-mono)] text-sm">GITHUB_TOKEN</code> is configured (
          <code className="font-[family-name:var(--font-mono)] text-sm">capabilities.canCreatePosts</code>).
        </p>
        <p className="mt-4">
          <strong>Categories</strong> and <strong>polls</strong> remain GitHub-only — use “Manage categories on GitHub” and
          “Create poll on GitHub” deep links. Community featured URLs / default slug are stored via{" "}
          <code className="font-[family-name:var(--font-mono)] text-sm">PUT /api/community/config</code> (master admin).
        </p>
      </>
    ),
  },
  {
    id: "usage-dual-signals",
    title: "Usage stats dual signals",
    content: (
      <>
        <p>Two independent signals power reach reporting:</p>
        <ul className="list-disc pl-5 space-y-2 mt-4">
          <li>
            <strong>Opt-in uniques</strong> — install heartbeats aggregated in KV (
            <code className="font-[family-name:var(--font-mono)] text-sm">optInUniques</code>).
          </li>
          <li>
            <strong>Visits / downloads</strong> — marketing site visits and marketplace download totals from{" "}
            <code className="font-[family-name:var(--font-mono)] text-sm">site-data.json</code> (
            <code className="font-[family-name:var(--font-mono)] text-sm">visitors</code> +{" "}
            <code className="font-[family-name:var(--font-mono)] text-sm">marketplace</code>).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "admin-button",
    title: "Admin button",
    content: (
      <>
        <p>
          Discreet <strong>Admin</strong> links on the marketing site and Community page footer point to{" "}
          <a href="https://cursor-dev.lorapok.tech" className="text-[var(--color-accent-2)] hover:underline" target="_blank" rel="noopener noreferrer">
            cursor-dev.lorapok.tech
          </a>
          . The sidebar pins an Admin control to{" "}
          <code className="font-[family-name:var(--font-mono)] text-sm">/dashboard</code> for signed-in operators.
        </p>
      </>
    ),
  },
  {
    id: "mail",
    title: "Mail",
    content: (
      <>
        <p>
          Transactional and contact email for Lorapok projects uses{" "}
          <a href="mailto:cursor-contact@lorapok.tech" className="text-[var(--color-accent-2)] hover:underline">
            cursor-contact@lorapok.tech
          </a>
          . Route support requests, collaboration inquiries, and deployment notifications through this address.
        </p>
        <p className="mt-4">
          Admin invite emails are sent via Firebase Authentication magic links when you add a team member. The link redirects
          to <code className="font-[family-name:var(--font-mono)] text-sm">/login</code> on this admin origin.
        </p>
      </>
    ),
  },
  {
    id: "team-invite",
    title: "Team Invite & Magic Link",
    content: (
      <>
        <p>
          Team Access manages who can sign into Mission Control. Inviting an admin:
        </p>
        <ol className="list-decimal pl-5 space-y-2 mt-4">
          <li>Adds their email to Firestore <code className="font-[family-name:var(--font-mono)] text-sm">admins</code> collection</li>
          <li>Syncs API access via Cloudflare KV (<code className="font-[family-name:var(--font-mono)] text-sm">ADMIN_KV</code>) or <code className="font-[family-name:var(--font-mono)] text-sm">ADMIN_EMAILS</code> env fallback</li>
          <li>Sends a Firebase email sign-in link to <code className="font-[family-name:var(--font-mono)] text-sm">/login</code></li>
        </ol>
        <p className="mt-4">
          The master admin (<code className="font-[family-name:var(--font-mono)] text-sm">mdshuvo40@gmail.com</code>) can add or remove
          team members. Ensure Firebase Auth authorized domains include <code className="font-[family-name:var(--font-mono)] text-sm">cursor-dev.lorapok.tech</code> and
          your <code className="font-[family-name:var(--font-mono)] text-sm">*.pages.dev</code> preview host.
        </p>
      </>
    ),
  },
  {
    id: "kv-firebase",
    title: "KV & Firebase",
    content: (
      <>
        <h4 className="font-semibold mb-2 text-[var(--color-text)]">Cloudflare KV</h4>
        <p>
          <code className="font-[family-name:var(--font-mono)] text-sm">ADMIN_KV</code> stores the canonical list of admin emails
          for Pages Functions auth. Create with <code className="font-[family-name:var(--font-mono)] text-sm">wrangler kv namespace create ADMIN_KV</code> and
          bind IDs in <code className="font-[family-name:var(--font-mono)] text-sm">wrangler.toml</code>.
        </p>
        <h4 className="font-semibold mt-6 mb-2 text-[var(--color-text)]">Firebase</h4>
        <p>
          Project <code className="font-[family-name:var(--font-mono)] text-sm">cursor-curse-by-lorapok</code> provides Google sign-in,
          Firestore for admin roster and live visitor stats, and email-link authentication for invites.
          Deploy rules: <code className="font-[family-name:var(--font-mono)] text-sm">firebase deploy --only firestore:rules</code>.
        </p>
      </>
    ),
  },
  {
    id: "credentials",
    title: "Credentials Policy",
    content: (
      <>
        <p>Never commit secrets. Required credentials by environment:</p>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                <th className="pb-2 pr-4">Secret</th>
                <th className="pb-2 pr-4">Where</th>
                <th className="pb-2">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {[
                ["GITHUB_TOKEN", "CF Pages env", "Workflow dispatch (deploy/rollback)"],
                ["OVSX_PAT", "GitHub Actions", "Open VSX publish"],
                ["VSCE_PAT", "GitHub Actions", "VS Code Marketplace publish"],
                ["CLOUDFLARE_API_TOKEN", "GitHub Actions", "Admin Pages deploy"],
                ["CLOUDFLARE_ACCOUNT_ID", "GitHub Actions", "Facility account ID"],
                ["ADMIN_MASTER_EMAIL", "CF Pages env", "Master admin bypass"],
                ["ADMIN_EMAILS", "CF Pages env (opt)", "KV fallback"],
              ].map(([secret, where, purpose]) => (
                <tr key={secret}>
                  <td className="py-2 pr-4 font-[family-name:var(--font-mono)] text-[var(--color-accent-2)]">{secret}</td>
                  <td className="py-2 pr-4 text-[var(--color-muted)]">{where}</td>
                  <td className="py-2">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[var(--color-muted)]">
          Local dev: copy <code className="font-[family-name:var(--font-mono)] text-sm">.env.example</code> to{" "}
          <code className="font-[family-name:var(--font-mono)] text-sm">.env</code> and add an optional GitHub token for tags and deploy.
        </p>
      </>
    ),
  },
  {
    id: "social",
    title: "Social & Links",
    content: (
      <>
        <ul className="space-y-3">
          <li>
            <strong>Open VSX (Cursor)</strong> —{" "}
            <a href="https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok" className="text-[var(--color-accent-2)] hover:underline" target="_blank" rel="noopener noreferrer">
              lorapok-labs/cursor-curse-monitor-by-lorapok
            </a>
          </li>
          <li>
            <strong>VS Code Marketplace</strong> —{" "}
            <a href="https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok" className="text-[var(--color-accent-2)] hover:underline" target="_blank" rel="noopener noreferrer">
              LorapokLabs.cursor-curse-monitor-by-lorapok
            </a>
          </li>
          <li>
            <strong>GitHub Releases</strong> —{" "}
            <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases" className="text-[var(--color-accent-2)] hover:underline" target="_blank" rel="noopener noreferrer">
              Maijied/Cursor-Curse-Monitor-by-Lorapok
            </a>
          </li>
          <li>
            <strong>Project website</strong> —{" "}
            <a href="https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/" className="text-[var(--color-accent-2)] hover:underline" target="_blank" rel="noopener noreferrer">
              GitHub Pages
            </a>
          </li>
          <li>
            <strong>Admin panel</strong> —{" "}
            <a href="https://cursor-dev.lorapok.tech" className="text-[var(--color-accent-2)] hover:underline" target="_blank" rel="noopener noreferrer">
              cursor-dev.lorapok.tech
            </a>
          </li>
        </ul>
      </>
    ),
  },
];

export default function Docs() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter(
      (s) => s.title.toLowerCase().includes(q) || s.id.includes(q)
    );
  }, [query]);

  return (
    <div className="animate-fade-slide-up">
      <PageHeader
        title="Documentation"
        description="Architecture, deployment, notices, analytics, and operations reference for Mission Control."
        action={
          <BookOpen className="text-[var(--color-accent)]" size={28} aria-hidden="true" />
        }
      />

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-56 shrink-0">
          <Card className="lg:sticky lg:top-6">
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search TOC…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
            <nav aria-label="Documentation table of contents">
              <ul className="space-y-1 text-sm">
                {filtered.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block px-3 py-2 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </Card>
        </aside>

        <div className="flex-1 min-w-0 space-y-10">
          {filtered.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-8">
              <Card>
                <h3 className="text-xl font-bold text-[var(--color-text)] mb-4 pb-3 border-b border-[var(--color-border)]">
                  {section.title}
                </h3>
                <div className="prose-docs text-[var(--color-muted)] leading-relaxed space-y-3">
                  {section.content}
                </div>
              </Card>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
