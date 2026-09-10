import { useAuthSession } from "../../lib/use-auth-session";
import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Save, Sparkles, Video } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import {
  fetchSocialAiConfigApi,
  putSocialAiConfigApi,
  type SocialAiConfig,
  type SocialImageProviderId,
} from "../../lib/api";

type ProviderForm = {
  model: string;
  promptPrefix: string;
  apiKey: string;
};

function emptyForm(): ProviderForm {
  return { model: "", promptPrefix: "", apiKey: "" };
}

export default function SocialAiConfigCard() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("integrations.write");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<SocialAiConfig | null>(null);
  const [activeProvider, setActiveProvider] = useState<SocialImageProviderId>("svg-fallback");
  const [forms, setForms] = useState<Record<string, ProviderForm>>({});
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoTemplate, setVideoTemplate] = useState("carousel");
  const [videoAspect, setVideoAspect] = useState("9:16");
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(false);

  useEffect(() => {
    fetchSocialAiConfigApi()
      .then((data) => {
        setConfig(data.config);
        setActiveProvider(data.config.activeProviderId);
        setVideoEnabled(data.config.video.enabled);
        setVideoTemplate(data.config.video.template);
        setVideoAspect(data.config.video.aspectRatio);
        setVoiceoverEnabled(data.config.video.voiceoverEnabled);
        const nextForms: Record<string, ProviderForm> = {};
        for (const provider of data.config.providers) {
          nextForms[provider.id] = {
            model: provider.model ?? "",
            promptPrefix: provider.promptPrefix ?? "",
            apiKey: "",
          };
        }
        setForms(nextForms);
      })
      .catch((err) => {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to load AI settings" });
      })
      .finally(() => setLoading(false));
  }, []);

  const activeEntry = useMemo(
    () => config?.providers.find((entry) => entry.id === activeProvider) ?? null,
    [config, activeProvider]
  );

  const handleSaveProvider = async () => {
    if (!canWrite || !activeEntry) return;
    setSaving(true);
    setMessage(null);
    try {
      const form = forms[activeProvider] ?? emptyForm();
      const result = await putSocialAiConfigApi({
        providerId: activeProvider,
        model: form.model,
        promptPrefix: form.promptPrefix,
        apiKey: form.apiKey || undefined,
        activate: true,
      });
      setConfig(result.config);
      setActiveProvider(result.config.activeProviderId);
      setMessage({ type: "success", text: `${activeEntry.label} activated and saved.` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVideo = async () => {
    if (!canWrite) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await putSocialAiConfigApi({
        section: "video",
        enabled: videoEnabled,
        template: videoTemplate,
        aspectRatio: videoAspect,
        voiceoverEnabled,
      });
      setConfig(result.config);
      setMessage({
        type: "success",
        text: videoEnabled
          ? "Video generator enabled — gallery builds static carousel frames."
          : "Video generator disabled — single image only.",
      });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <LorapokLarvaeLoader label="Loading AI provider settings…" />
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
          AI image & video
        </h3>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Register AI image providers (SOCIAL-04) — exactly one active at a time. Optional short-form video carousel
          manifest for Reels/Stories (SOCIAL-05); falls back to static frames when MP4 encoding is unavailable.
        </p>
      </div>

      {message && (
        <Notification
          tone={message.type === "success" ? "success" : "error"}
          message={message.text}
          className="mb-4"
          onDismiss={() => setMessage(null)}
        />
      )}

      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <ImageIcon className="w-4 h-4" aria-hidden />
            Image providers
          </h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {(config?.providers ?? []).map((provider) => (
              <button
                key={provider.id}
                type="button"
                disabled={!canWrite}
                onClick={() => setActiveProvider(provider.id)}
                className={`px-3 py-1.5 rounded-full text-xs border transition ${
                  activeProvider === provider.id
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] hover:border-[var(--color-accent)]/50"
                }`}
              >
                {provider.label}
                {provider.active && (
                  <Badge variant="synced" className="ml-2 text-[10px]">active</Badge>
                )}
                <Badge variant={provider.tier === "free" ? "neutral" : "warn"} className="ml-1 text-[10px]">
                  {provider.tier}
                </Badge>
              </button>
            ))}
          </div>

          {activeEntry && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="text-[var(--color-muted)]">Model</span>
                <input
                  className="mt-1 w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm"
                  value={forms[activeProvider]?.model ?? ""}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setForms((prev) => ({
                      ...prev,
                      [activeProvider]: { ...(prev[activeProvider] ?? emptyForm()), model: e.target.value },
                    }))
                  }
                  placeholder={activeEntry.id === "pollinations" ? "flux" : "model id"}
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="text-[var(--color-muted)]">Prompt prefix</span>
                <textarea
                  className="mt-1 w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm min-h-[72px]"
                  value={forms[activeProvider]?.promptPrefix ?? ""}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setForms((prev) => ({
                      ...prev,
                      [activeProvider]: { ...(prev[activeProvider] ?? emptyForm()), promptPrefix: e.target.value },
                    }))
                  }
                />
              </label>
              {activeEntry.tier === "paid" && (
                <label className="block text-sm md:col-span-2">
                  <span className="text-[var(--color-muted)]">API key</span>
                  <input
                    type="password"
                    className="mt-1 w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm"
                    value={forms[activeProvider]?.apiKey ?? ""}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setForms((prev) => ({
                        ...prev,
                        [activeProvider]: { ...(prev[activeProvider] ?? emptyForm()), apiKey: e.target.value },
                      }))
                    }
                    placeholder={activeEntry.apiKeyPreview ? `configured ${activeEntry.apiKeyPreview}` : "paste key"}
                  />
                </label>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={!canWrite || saving}
            onClick={handleSaveProvider}
            className="mt-4 inline-flex items-center gap-2 rounded bg-[var(--color-accent)] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            <Save className="w-4 h-4" aria-hidden />
            Activate & save provider
          </button>
        </section>

        <section className="border-t border-[var(--color-border)] pt-6">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Video className="w-4 h-4" aria-hidden />
            Video generator (SOCIAL-05)
          </h3>
          <label className="flex items-center gap-2 text-sm mb-3">
            <input
              type="checkbox"
              checked={videoEnabled}
              disabled={!canWrite}
              onChange={(e) => setVideoEnabled(e.target.checked)}
            />
            Enable short-form carousel manifest for Stories/Reels
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[var(--color-muted)]">Template</span>
              <select
                className="mt-1 w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm"
                value={videoTemplate}
                disabled={!canWrite || !videoEnabled}
                onChange={(e) => setVideoTemplate(e.target.value)}
              >
                <option value="carousel">Carousel (changelog bullets)</option>
                <option value="slideshow">Slideshow</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--color-muted)]">Aspect ratio</span>
              <select
                className="mt-1 w-full rounded border border-[var(--color-border)] px-3 py-2 text-sm"
                value={videoAspect}
                disabled={!canWrite || !videoEnabled}
                onChange={(e) => setVideoAspect(e.target.value)}
              >
                <option value="9:16">9:16 (Stories/Reels)</option>
                <option value="1:1">1:1 (feed)</option>
                <option value="16:9">16:9 (Shorts landscape)</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm mt-3">
            <input
              type="checkbox"
              checked={voiceoverEnabled}
              disabled={!canWrite || !videoEnabled}
              onChange={(e) => setVoiceoverEnabled(e.target.checked)}
            />
            Voiceover from changelog (optional — not yet encoded to audio)
          </label>
          <button
            type="button"
            disabled={!canWrite || saving}
            onClick={handleSaveVideo}
            className="mt-4 inline-flex items-center gap-2 rounded border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" aria-hidden />
            Save video settings
          </button>
        </section>
      </div>
    </Card>
  );

}
