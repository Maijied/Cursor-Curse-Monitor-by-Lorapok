import { useAuthSession } from "../../lib/use-auth-session";
import { useEffect, useMemo, useState } from "react";
import { Globe, Save, Search } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import SectionReferLink from "./SectionReferLink";
import { SECTION_REFERS } from "../../lib/section-refer";
import {
  fetchSeoConfigApi,
  putSeoConfigApi,
  type SeoConfig,
  type SeoIndexingPolicy,
  type SeoProviderId,
} from "../../lib/api";

const PROVIDERS: Array<{
  id: SeoProviderId;
  label: string;
  help: string;
}> = [
  {
    id: "googleSearchConsole",
    label: "Google Search Console",
    help: "Verified property URL (https://cursor.lorapok.tech). Optional service account JSON for API pulls.",
  },
  {
    id: "bingWebmaster",
    label: "Bing Webmaster",
    help: "Site URL and Bing Webmaster API key for sitemap and crawl status.",
  },
  {
    id: "azureWebmaster",
    label: "Azure Webmaster",
    help: "Microsoft Bing/Azure Webmaster site URL and API key.",
  },
  {
    id: "cloudflareAnalytics",
    label: "Cloudflare analytics",
    help: "Zone ID and API token with Analytics read access for Core Web Vitals trends.",
  },
  {
    id: "pageSpeedInsights",
    label: "PageSpeed Insights",
    help: "Google PageSpeed API key and lab URL for scheduled CWV checks.",
  },
];

type ProviderForm = {
  enabled: boolean;
  siteUrl: string;
  zoneId: string;
  serviceAccountJson: string;
  apiKey: string;
  apiToken: string;
};

function emptyForm(): ProviderForm {
  return {
    enabled: false,
    siteUrl: "",
    zoneId: "",
    serviceAccountJson: "",
    apiKey: "",
    apiToken: "",
  };
}

function formFromConfig(config: SeoConfig | null, provider: SeoProviderId): ProviderForm {
  const data = config?.providers?.[provider];
  return {
    enabled: Boolean(data?.enabled),
    siteUrl: data?.siteUrl ?? "",
    zoneId: data?.zoneId ?? "",
    serviceAccountJson: "",
    apiKey: "",
    apiToken: "",
  };
}

export default function SeoIntegrationsCard() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("integrations.write");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<SeoConfig | null>(null);
  const [policy, setPolicy] = useState<SeoIndexingPolicy | null>(null);
  const [activeProvider, setActiveProvider] = useState<SeoProviderId>("googleSearchConsole");
  const [hubSitemapUrl, setHubSitemapUrl] = useState("");
  const [hubRobotsNotes, setHubRobotsNotes] = useState("");
  const [forms, setForms] = useState<Record<SeoProviderId, ProviderForm>>(() =>
    Object.fromEntries(PROVIDERS.map((p) => [p.id, emptyForm()])) as Record<SeoProviderId, ProviderForm>
  );

  useEffect(() => {
    Promise.all([
      fetchSeoConfigApi(),
      fetch("/seo.json")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([configRes, seoManifest]) => {
        setConfig(configRes.config);
        setPolicy(seoManifest?.indexingPolicy ?? null);
        setHubSitemapUrl(configRes.config.hub?.sitemapUrl || seoManifest?.indexingPolicy?.sitemapUrl || "");
        setHubRobotsNotes(configRes.config.hub?.robotsNotes ?? "");
        setForms(
          Object.fromEntries(
            PROVIDERS.map((p) => [p.id, formFromConfig(configRes.config, p.id)])
          ) as Record<SeoProviderId, ProviderForm>
        );
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  const activeMeta = useMemo(
    () => PROVIDERS.find((p) => p.id === activeProvider) ?? PROVIDERS[0],
    [activeProvider]
  );
  const activeForm = forms[activeProvider];

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)] font-[family-name:var(--font-mono)] text-sm";

  const updateForm = (patch: Partial<ProviderForm>) => {
    setForms((prev) => ({ ...prev, [activeProvider]: { ...prev[activeProvider], ...patch } }));
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, string | boolean> = {
        provider: activeProvider,
        enabled: activeForm.enabled,
        siteUrl: activeForm.siteUrl.trim(),
      };
      if (activeProvider === "googleSearchConsole" && activeForm.serviceAccountJson.trim()) {
        payload.serviceAccountJson = activeForm.serviceAccountJson.trim();
      }
      if (
        (activeProvider === "bingWebmaster" || activeProvider === "azureWebmaster") &&
        activeForm.apiKey.trim()
      ) {
        payload.apiKey = activeForm.apiKey.trim();
      }
      if (activeProvider === "cloudflareAnalytics") {
        payload.zoneId = activeForm.zoneId.trim();
        if (activeForm.apiToken.trim()) payload.apiToken = activeForm.apiToken.trim();
      }
      if (activeProvider === "pageSpeedInsights" && activeForm.apiKey.trim()) {
        payload.apiKey = activeForm.apiKey.trim();
      }

      const result = await putSeoConfigApi(payload);
      setConfig(result.config);
      setForms((prev) => ({
        ...prev,
        [activeProvider]: {
          ...prev[activeProvider],
          serviceAccountJson: "",
          apiKey: "",
          apiToken: "",
        },
      }));
      setMessage({ type: "success", text: `${activeMeta.label} settings saved.` });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handleSaveHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await putSeoConfigApi({
        section: "hub",
        sitemapUrl: hubSitemapUrl.trim(),
        robotsNotes: hubRobotsNotes.trim(),
      });
      setConfig(result.config);
      setMessage({ type: "success", text: "Sitemap and robots notes saved." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Search size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
              SEO integrations
            </h3>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Credentials stored in ADMIN_KV under <code className="text-xs">integrations:seo</code>. Live API
              clients ship in a follow-up — this hub captures Lorapok search/analytics wiring.
            </p>
          </div>
          {config && (
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant={config.configured ? "synced" : "neutral"}>
                {config.enabledCount} provider{config.enabledCount === 1 ? "" : "s"} configured
              </Badge>
              <SectionReferLink {...SECTION_REFERS.seo} label="SEO dashboard" />
            </div>
          )}
        </div>

        {loading ? (
          <LorapokLarvaeLoader label="Loading SEO settings…" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {PROVIDERS.map((provider) => {
                const configured = config?.providers?.[provider.id]?.configured;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => setActiveProvider(provider.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      activeProvider === provider.id
                        ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)]"
                        : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {provider.label}
                    {configured ? " ✓" : ""}
                  </button>
                );
              })}
            </div>

            <p className="text-sm text-[var(--color-muted)] mb-4">{activeMeta.help}</p>

            <form onSubmit={handleSaveProvider} className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={activeForm.enabled}
                  onChange={(e) => updateForm({ enabled: e.target.checked })}
                  disabled={!canWrite}
                />
                Enable {activeMeta.label}
              </label>

              {(activeProvider === "googleSearchConsole" ||
                activeProvider === "bingWebmaster" ||
                activeProvider === "azureWebmaster" ||
                activeProvider === "pageSpeedInsights" ||
                activeProvider === "cloudflareAnalytics") && (
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="seo-site-url">
                    Site URL
                  </label>
                  <input
                    id="seo-site-url"
                    className={inputClass}
                    value={activeForm.siteUrl}
                    onChange={(e) => updateForm({ siteUrl: e.target.value })}
                    placeholder="https://cursor.lorapok.tech"
                    disabled={!canWrite}
                  />
                </div>
              )}

              {activeProvider === "cloudflareAnalytics" && (
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="seo-zone-id">
                    Zone ID
                  </label>
                  <input
                    id="seo-zone-id"
                    className={inputClass}
                    value={activeForm.zoneId}
                    onChange={(e) => updateForm({ zoneId: e.target.value })}
                    disabled={!canWrite}
                  />
                </div>
              )}

              {activeProvider === "googleSearchConsole" && (
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="seo-gsc-sa">
                    Service account JSON
                    {config?.providers.googleSearchConsole.serviceAccountPreview ? (
                      <span className="text-[var(--color-muted)] font-normal ml-2">
                        ({config.providers.googleSearchConsole.serviceAccountPreview})
                      </span>
                    ) : null}
                  </label>
                  <textarea
                    id="seo-gsc-sa"
                    className={`${inputClass} min-h-[88px]`}
                    value={activeForm.serviceAccountJson}
                    onChange={(e) => updateForm({ serviceAccountJson: e.target.value })}
                    placeholder='{"type":"service_account",…}'
                    disabled={!canWrite}
                  />
                </div>
              )}

              {(activeProvider === "bingWebmaster" ||
                activeProvider === "azureWebmaster" ||
                activeProvider === "pageSpeedInsights") && (
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="seo-api-key">
                    API key
                    {config?.providers[activeProvider].apiKeyPreview ? (
                      <span className="text-[var(--color-muted)] font-normal ml-2">
                        ({config.providers[activeProvider].apiKeyPreview})
                      </span>
                    ) : null}
                  </label>
                  <input
                    id="seo-api-key"
                    type="password"
                    autoComplete="off"
                    className={inputClass}
                    value={activeForm.apiKey}
                    onChange={(e) => updateForm({ apiKey: e.target.value })}
                    disabled={!canWrite}
                  />
                </div>
              )}

              {activeProvider === "cloudflareAnalytics" && (
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="seo-cf-token">
                    API token
                    {config?.providers.cloudflareAnalytics.apiTokenPreview ? (
                      <span className="text-[var(--color-muted)] font-normal ml-2">
                        ({config.providers.cloudflareAnalytics.apiTokenPreview})
                      </span>
                    ) : null}
                  </label>
                  <input
                    id="seo-cf-token"
                    type="password"
                    autoComplete="off"
                    className={inputClass}
                    value={activeForm.apiToken}
                    onChange={(e) => updateForm({ apiToken: e.target.value })}
                    disabled={!canWrite}
                  />
                </div>
              )}

              {message && <Notification type={message.type} message={message.text} />}

              <button
                type="submit"
                disabled={!canWrite || saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50"
              >
                <Save size={16} aria-hidden="true" />
                {saving ? "Saving…" : `Save ${activeMeta.label}`}
              </button>
            </form>
          </>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <Globe size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
          Sitemap & robots
        </h3>
        <form onSubmit={handleSaveHub} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="seo-sitemap-url">
              Sitemap URL override
            </label>
            <input
              id="seo-sitemap-url"
              className={inputClass}
              value={hubSitemapUrl}
              onChange={(e) => setHubSitemapUrl(e.target.value)}
              placeholder={policy?.sitemapUrl ?? "https://cursor.lorapok.tech/sitemap.xml"}
              disabled={!canWrite}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="seo-robots-notes">
              Robots notes (internal)
            </label>
            <textarea
              id="seo-robots-notes"
              className={`${inputClass} min-h-[72px]`}
              value={hubRobotsNotes}
              onChange={(e) => setHubRobotsNotes(e.target.value)}
              placeholder="Disallow paths, staging rules, or crawl budget notes…"
              disabled={!canWrite}
            />
          </div>
          <button
            type="submit"
            disabled={!canWrite || saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium disabled:opacity-50"
          >
            <Save size={16} aria-hidden="true" />
            Save hub settings
          </button>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold">Indexing policy (read-only)</h3>
          <SectionReferLink {...SECTION_REFERS.settingsSeo} label="Settings → SEO" />
        </div>
        {policy ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">Admin noindex</dt>
              <dd>{policy.adminNoindex ? "yes" : "no"}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Marketing indexable</dt>
              <dd>{policy.marketingAllow ? "yes" : "no"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--color-muted)]">Policy summary</dt>
              <dd>{policy.policySummary}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Sitemap</dt>
              <dd className="break-all">
                <a href={policy.sitemapUrl} className="text-[var(--color-accent-2)] hover:underline">
                  {policy.sitemapUrl}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Robots</dt>
              <dd className="break-all">
                <a href={policy.robotsUrl} className="text-[var(--color-accent-2)] hover:underline">
                  {policy.robotsUrl}
                </a>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--color-muted)]">Excluded admin URLs</dt>
              <dd>
                <ul className="list-disc pl-5 space-y-1">
                  {policy.adminUrls.map((url) => (
                    <li key={url} className="break-all">
                      {url}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            Run <code className="text-xs">npm run site:seo</code> to generate indexingPolicy in seo.json.
          </p>
        )}
      </Card>
    </div>
  );
}
