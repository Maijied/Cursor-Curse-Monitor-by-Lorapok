import { useAuthSession } from "../../lib/auth-context";
import { useEffect, useMemo, useState } from "react";
import { Megaphone, Save, Send, Share2 } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import SectionReferLink from "./SectionReferLink";
import { SECTION_REFERS } from "../../lib/section-refer";
import {
  fetchSocialConfigApi,
  fetchSocialPreviewApi,
  putSocialConfigApi,
  testSocialMatrixApi,
  type SocialConfig,
  type SocialPlatformId,
  type SocialTemplateCard,
} from "../../lib/api";

const PLATFORMS: Array<{
  id: SocialPlatformId;
  label: string;
  help: string;
}> = [
  {
    id: "telegram",
    label: "Telegram",
    help: "Bot token from @BotFather and channel/chat ID for Lorapok announcements.",
  },
  {
    id: "mastodon",
    label: "Mastodon",
    help: "Instance URL (https://mastodon.social) and access token with write:statuses.",
  },
  {
    id: "bluesky",
    label: "Bluesky",
    help: "Handle (user.bsky.social) and app password from Bluesky settings.",
  },
  {
    id: "x",
    label: "X (Twitter)",
    help: "OAuth 2.0 bearer token with tweet.write scope (X API v2).",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    help: "Marketing API access token and author URN (urn:li:organization:… or person).",
  },
];

type PlatformForm = {
  enabled: boolean;
  botToken: string;
  chatId: string;
  instanceUrl: string;
  accessToken: string;
  handle: string;
  appPassword: string;
  bearerToken: string;
  authorUrn: string;
};

function emptyForm(): PlatformForm {
  return {
    enabled: false,
    botToken: "",
    chatId: "",
    instanceUrl: "",
    accessToken: "",
    handle: "",
    appPassword: "",
    bearerToken: "",
    authorUrn: "",
  };
}

function formFromConfig(config: SocialConfig | null, platform: SocialPlatformId): PlatformForm {
  const data = config?.platforms?.[platform];
  return {
    enabled: Boolean(data?.enabled),
    botToken: "",
    chatId: data?.chatId ?? "",
    instanceUrl: data?.instanceUrl ?? "",
    accessToken: "",
    handle: data?.handle ?? "",
    appPassword: "",
    bearerToken: "",
    authorUrn: data?.authorUrn ?? "",
  };
}

export default function SocialIntegrationsCard() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("integrations.write");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<SocialConfig | null>(null);
  const [activePlatform, setActivePlatform] = useState<SocialPlatformId>("telegram");
  const [templateId, setTemplateId] = useState("deploy-digest");
  const [templates, setTemplates] = useState<SocialTemplateCard[]>([]);
  const [previewText, setPreviewText] = useState("");
  const [forms, setForms] = useState<Record<SocialPlatformId, PlatformForm>>(() =>
    Object.fromEntries(PLATFORMS.map((p) => [p.id, emptyForm()])) as Record<SocialPlatformId, PlatformForm>
  );

  useEffect(() => {
    Promise.all([fetchSocialConfigApi(), fetchSocialPreviewApi()])
      .then(([configRes, previewRes]) => {
        setConfig(configRes.config);
        setTemplates(previewRes.items ?? []);
        setPreviewText(previewRes.previews?.[0]?.text ?? "");
        setForms(
          Object.fromEntries(
            PLATFORMS.map((p) => [p.id, formFromConfig(configRes.config, p.id)])
          ) as Record<SocialPlatformId, PlatformForm>
        );
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSocialPreviewApi(templateId)
      .then((data) => setPreviewText(data.previews?.[0]?.text ?? ""))
      .catch(() => setPreviewText(""));
  }, [templateId]);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)] font-[family-name:var(--font-mono)] text-sm";

  const activeMeta = PLATFORMS.find((p) => p.id === activePlatform)!;
  const activeForm = forms[activePlatform];
  const activeStatus = config?.platforms?.[activePlatform];

  const configuredCount = useMemo(
    () => PLATFORMS.filter((p) => config?.platforms?.[p.id]?.configured).length,
    [config]
  );

  const updateForm = (patch: Partial<PlatformForm>) => {
    setForms((prev) => ({ ...prev, [activePlatform]: { ...prev[activePlatform], ...patch } }));
  };

  const buildPayload = (): Record<string, string | boolean> => {
    const form = forms[activePlatform];
    const payload: Record<string, string | boolean> = { enabled: form.enabled };
    switch (activePlatform) {
      case "telegram":
        if (form.botToken.trim()) payload.botToken = form.botToken.trim();
        payload.chatId = form.chatId.trim();
        break;
      case "mastodon":
        payload.instanceUrl = form.instanceUrl.trim();
        if (form.accessToken.trim()) payload.accessToken = form.accessToken.trim();
        break;
      case "bluesky":
        payload.handle = form.handle.trim();
        if (form.appPassword.trim()) payload.appPassword = form.appPassword.trim();
        break;
      case "x":
        if (form.bearerToken.trim()) payload.bearerToken = form.bearerToken.trim();
        break;
      case "linkedin":
        if (form.accessToken.trim()) payload.accessToken = form.accessToken.trim();
        payload.authorUrn = form.authorUrn.trim();
        break;
    }
    return payload;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await putSocialConfigApi(activePlatform, buildPayload());
      setConfig(result.config);
      setForms((prev) => ({
        ...prev,
        [activePlatform]: {
          ...prev[activePlatform],
          botToken: "",
          accessToken: "",
          appPassword: "",
          bearerToken: "",
        },
      }));
      setMessage({ type: "success", text: `${activeMeta.label} settings saved.` });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handleTest = async (platform: SocialPlatformId | "all") => {
    if (!canWrite) return;
    setTesting(true);
    setMessage(null);
    try {
      const result = await testSocialMatrixApi({ template: templateId, platform, dryRun });
      const label = dryRun ? "Dry-run" : "Live test";
      setMessage({
        type: result.ok ? "success" : "error",
        text: `${label}: ${result.summary.sent} sent, ${result.summary.skipped} skipped, ${result.summary.failed} failed.`,
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Test failed" });
    }
    setTesting(false);
  };

  if (loading) {
    return (
      <Card>
        <LorapokLarvaeLoader label="Loading social integrations…" />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Share2 size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
              Multi-platform social
            </h3>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Lorapok-branded captions for Telegram, Mastodon, Bluesky, X, and LinkedIn. Discord stays on the Discord tab.
            </p>
            <SectionReferLink {...SECTION_REFERS.settingsDiscord} className="mt-2" />
          </div>
          <Badge variant={configuredCount > 0 ? "synced" : "warn"}>
            {configuredCount > 0 ? `${configuredCount} channel${configuredCount === 1 ? "" : "s"}` : "Not configured"}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {PLATFORMS.map((platform) => {
            const selected = platform.id === activePlatform;
            const configured = config?.platforms?.[platform.id]?.configured;
            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => setActivePlatform(platform.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  selected
                    ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {platform.label}
                {configured ? " ✓" : ""}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <p className="text-sm text-[var(--color-muted)]">{activeMeta.help}</p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activeForm.enabled}
              onChange={(e) => updateForm({ enabled: e.target.checked })}
              disabled={!canWrite}
            />
            Enable {activeMeta.label}
          </label>

          {activePlatform === "telegram" && (
            <>
              <div>
                <label htmlFor="social-telegram-token" className="block text-sm font-medium mb-2">
                  Bot token
                </label>
                <input
                  id="social-telegram-token"
                  className={inputClass}
                  value={activeForm.botToken}
                  onChange={(e) => updateForm({ botToken: e.target.value })}
                  placeholder={activeStatus?.botTokenPreview ? `Saved: ${activeStatus.botTokenPreview}` : "123456:ABC…"}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <label htmlFor="social-telegram-chat" className="block text-sm font-medium mb-2">
                  Chat ID
                </label>
                <input
                  id="social-telegram-chat"
                  className={inputClass}
                  value={activeForm.chatId}
                  onChange={(e) => updateForm({ chatId: e.target.value })}
                  placeholder="-1001234567890"
                  disabled={!canWrite}
                />
              </div>
            </>
          )}

          {activePlatform === "mastodon" && (
            <>
              <div>
                <label htmlFor="social-mastodon-instance" className="block text-sm font-medium mb-2">
                  Instance URL
                </label>
                <input
                  id="social-mastodon-instance"
                  className={inputClass}
                  value={activeForm.instanceUrl}
                  onChange={(e) => updateForm({ instanceUrl: e.target.value })}
                  placeholder="https://mastodon.social"
                  disabled={!canWrite}
                />
              </div>
              <div>
                <label htmlFor="social-mastodon-token" className="block text-sm font-medium mb-2">
                  Access token
                </label>
                <input
                  id="social-mastodon-token"
                  className={inputClass}
                  value={activeForm.accessToken}
                  onChange={(e) => updateForm({ accessToken: e.target.value })}
                  placeholder={activeStatus?.accessTokenPreview ? `Saved: ${activeStatus.accessTokenPreview}` : "Token…"}
                  disabled={!canWrite}
                />
              </div>
            </>
          )}

          {activePlatform === "bluesky" && (
            <>
              <div>
                <label htmlFor="social-bluesky-handle" className="block text-sm font-medium mb-2">
                  Handle
                </label>
                <input
                  id="social-bluesky-handle"
                  className={inputClass}
                  value={activeForm.handle}
                  onChange={(e) => updateForm({ handle: e.target.value })}
                  placeholder="lorapoklabs.bsky.social"
                  disabled={!canWrite}
                />
              </div>
              <div>
                <label htmlFor="social-bluesky-password" className="block text-sm font-medium mb-2">
                  App password
                </label>
                <input
                  id="social-bluesky-password"
                  type="password"
                  className={inputClass}
                  value={activeForm.appPassword}
                  onChange={(e) => updateForm({ appPassword: e.target.value })}
                  placeholder={activeStatus?.appPasswordPreview ? `Saved: ${activeStatus.appPasswordPreview}` : "xxxx-xxxx-xxxx-xxxx"}
                  disabled={!canWrite}
                />
              </div>
            </>
          )}

          {activePlatform === "x" && (
            <div>
              <label htmlFor="social-x-token" className="block text-sm font-medium mb-2">
                Bearer token
              </label>
              <input
                id="social-x-token"
                type="password"
                className={inputClass}
                value={activeForm.bearerToken}
                onChange={(e) => updateForm({ bearerToken: e.target.value })}
                placeholder={activeStatus?.bearerTokenPreview ? `Saved: ${activeStatus.bearerTokenPreview}` : "AAAA…"}
                disabled={!canWrite}
              />
            </div>
          )}

          {activePlatform === "linkedin" && (
            <>
              <div>
                <label htmlFor="social-linkedin-urn" className="block text-sm font-medium mb-2">
                  Author URN
                </label>
                <input
                  id="social-linkedin-urn"
                  className={inputClass}
                  value={activeForm.authorUrn}
                  onChange={(e) => updateForm({ authorUrn: e.target.value })}
                  placeholder="urn:li:organization:123456"
                  disabled={!canWrite}
                />
              </div>
              <div>
                <label htmlFor="social-linkedin-token" className="block text-sm font-medium mb-2">
                  Access token
                </label>
                <input
                  id="social-linkedin-token"
                  type="password"
                  className={inputClass}
                  value={activeForm.accessToken}
                  onChange={(e) => updateForm({ accessToken: e.target.value })}
                  placeholder={activeStatus?.accessTokenPreview ? `Saved: ${activeStatus.accessTokenPreview}` : "Token…"}
                  disabled={!canWrite}
                />
              </div>
            </>
          )}

          {canWrite && (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving…" : `Save ${activeMeta.label}`}
            </button>
          )}
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Megaphone size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
              Test-send matrix
            </h3>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Preview Lorapok captions and send to enabled platforms. Start with dry-run to validate the matrix without posting.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <div>
            <label htmlFor="social-template" className="block text-sm font-medium mb-2">
              Template
            </label>
            <select
              id="social-template"
              className={inputClass}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-end gap-2 text-sm pb-3">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} disabled={!canWrite} />
            Dry-run (no live posts)
          </label>
        </div>

        <pre className="text-xs whitespace-pre-wrap rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-4 mb-4 max-h-48 overflow-auto">
          {previewText || "Preview unavailable"}
        </pre>

        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={testing}
              onClick={() => handleTest(activePlatform)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] hover:bg-white/5 disabled:opacity-50"
            >
              <Send size={16} aria-hidden="true" />
              Test {activeMeta.label}
            </button>
            <button
              type="button"
              disabled={testing}
              onClick={() => handleTest("all")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] disabled:opacity-50"
            >
              <Send size={16} aria-hidden="true" />
              Test all enabled
            </button>
          </div>
        )}
      </Card>

      {message && (
        <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} onDismiss={() => setMessage(null)} />
      )}
    </>
  );
}
