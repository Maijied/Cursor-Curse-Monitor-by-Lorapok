import { useAuthSession } from "../../lib/auth-context";
import { useCallback, useEffect, useState } from "react";
import { Eye, Send, Sparkles } from "lucide-react";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import {
  fetchDiscordGalleryApi,
  notifyDiscordCommunityApi,
  notifyDiscordDeploymentApi,
  notifyDiscordFeedbackApi,
  sendDiscordDigestTestApi,
  type DiscordConfig,
  type DiscordEmbedPreview,
  type DiscordGalleryCard,
} from "../../lib/api";

function embedColorHex(color?: number) {
  if (color == null) return "var(--color-border)";
  return `#${color.toString(16).padStart(6, "0")}`;
}

function isWebhookReady(config: DiscordConfig | null, card: DiscordGalleryCard) {
  if (!config || !card.configuredKey) return false;
  return Boolean(config[card.configuredKey as keyof DiscordConfig]);
}

/**
 * Lorapok Discord card gallery — inline previews and one-click test-send matrix (DC-07).
 */
export default function DiscordCardGallery() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("integrations.write");
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<DiscordConfig | null>(null);
  const [previews, setPreviews] = useState<Array<{ card: DiscordGalleryCard; embed: DiscordEmbedPreview }>>([]);
  const [expandedId, setExpandedId] = useState<string | null>("deploy-success");

  const load = useCallback(() => {
    setLoading(true);
    fetchDiscordGalleryApi()
      .then((data) => {
        setConfig(data.config);
        setPreviews(data.previews ?? []);
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleTestSend = async (card: DiscordGalleryCard) => {
    if (!canWrite) return;
    setSendingId(card.id);
    setMessage(null);
    try {
      let result: { ok?: boolean; skipped?: boolean };
      if (card.id === "deploy-success") {
        result = await notifyDiscordDeploymentApi({
          actionType: "deployment-status-test",
          tag: "v1.0.31",
          channel: "Production",
          market: "Open VSX · VS Code · GitHub",
          conclusion: "success",
          jobs: [
            { name: "Build & Validate", conclusion: "success" },
            { name: "Deploy Admin Panel", conclusion: "success" },
          ],
          summary: "Gallery test — CI/CD success card with marketplace sync and changelog.",
        });
      } else if (card.id === "deploy-failure") {
        result = await notifyDiscordDeploymentApi({
          actionType: "publish-tag",
          tag: "v1.0.31",
          conclusion: "failure",
          runUrl: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/actions/runs/1",
          jobs: [
            { name: "Build & Validate", conclusion: "success" },
            { name: "Deploy to Marketplaces", conclusion: "failure" },
          ],
          summary: "Gallery test — CI/CD failure card with rollback hint.",
        });
      } else if (card.id === "download-digest") {
        result = await sendDiscordDigestTestApi();
      } else if (card.id === "feedback") {
        result = await notifyDiscordFeedbackApi();
      } else if (card.id === "community") {
        result = await notifyDiscordCommunityApi();
      } else {
        throw new Error("Unknown card type");
      }

      if (result.skipped) {
        setMessage({ type: "error", text: `Test skipped — configure the ${card.webhook} webhook first.` });
      } else {
        setMessage({ type: "success", text: `${card.label} test sent to Discord.` });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Test send failed" });
    }
    setSendingId(null);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Discord card gallery
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Preview Lorapok-branded embeds for deploy success/failure, digest, feedback, and community — then send a
            one-click test to each configured webhook.
          </p>
        </div>
        <Badge variant="synced">DC-07 preview</Badge>
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      {loading ? (
        <div className="flex items-center gap-3 py-6 justify-center text-sm text-[var(--color-muted)]">
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading Discord card gallery" className="!flex-row !gap-3" />
          <span>Loading card previews…</span>
        </div>
      ) : (
        <div className="space-y-3">
          {previews.map(({ card, embed }) => {
            const expanded = expandedId === card.id;
            const ready = isWebhookReady(config, card);
            return (
              <div
                key={card.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[var(--color-border)]">
                  <div>
                    <p className="font-medium">{card.label}</p>
                    <p className="text-xs text-[var(--color-muted)]">{card.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={ready ? "synced" : "warn"}>{ready ? "Webhook ready" : "Webhook missing"}</Badge>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : card.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm hover:bg-white/5"
                    >
                      <Eye size={14} aria-hidden="true" />
                      {expanded ? "Hide" : "Preview"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestSend(card)}
                      disabled={!canWrite || !ready || sendingId === card.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50"
                    >
                      <Send size={14} aria-hidden="true" />
                      {sendingId === card.id ? "Sending…" : "Send test"}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="p-4">
                    <div
                      className="rounded-lg border-l-4 p-4 text-sm space-y-2"
                      style={{ borderLeftColor: embedColorHex(embed.color) }}
                    >
                      <p className="font-semibold">{embed.title ?? "Discord embed"}</p>
                      {embed.description && (
                        <p className="text-[var(--color-muted)] whitespace-pre-wrap line-clamp-6">{embed.description}</p>
                      )}
                      {embed.fields && embed.fields.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2 pt-2">
                          {embed.fields.slice(0, 6).map((field) => (
                            <div key={field.name} className="rounded-lg bg-black/20 px-3 py-2">
                              <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{field.name}</p>
                              <p className="font-[family-name:var(--font-mono)] text-xs mt-1">{field.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {embed.footer?.text && (
                        <p className="text-xs text-[var(--color-muted)] pt-2 border-t border-[var(--color-border)]">
                          {embed.footer.text}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!canWrite && (
        <p className="text-xs text-[var(--color-warn)] mt-4">Requires integrations.write to send test cards.</p>
      )}
    </Card>
  );
}
