import { useAuthSession } from "../../lib/use-auth-session";
import { useCallback, useEffect, useState } from "react";
import { ImageIcon, RefreshCw, Send, Sparkles, Wand2 } from "lucide-react";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import {
  fetchSocialGalleryApi,
  generateSocialGalleryItemApi,
  publishSocialGalleryItemApi,
  updateSocialGalleryItemApi,
  type SocialGalleryItem,
} from "../../lib/api";

function statusVariant(status: string): "synced" | "warn" | "danger" | "neutral" {
  if (status === "ready") return "synced";
  if (status === "generating" || status === "pending") return "warn";
  if (status === "failed") return "danger";
  return "neutral";
}

/**
 * Deploy social gallery — Lorapok release cards with generate + one-click publish (SOCIAL-02/03).
 */
export default function SocialGallery() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("integrations.write");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SocialGalleryItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { caption: string; hashtags: string }>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetchSocialGalleryApi()
      .then((data) => {
        setItems(data.items ?? []);
        setDrafts((prev) => {
          const next = { ...prev };
          for (const item of data.items ?? []) {
            if (!next[item.id]) {
              next[item.id] = {
                caption: item.caption ?? "",
                hashtags: item.hashtags ?? "#CursorIDE #VSCode #OpenSource #LorapokLabs",
              };
            }
          }
          return next;
        });
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async (item: SocialGalleryItem) => {
    if (!canWrite) return;
    setBusyId(item.id);
    setMessage(null);
    try {
      const result = await generateSocialGalleryItemApi(item.id);
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? result.item : entry)));
      setMessage({
        type: "success",
        text: result.skipped ? "Asset already ready." : "Lorapok gallery asset generated.",
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Generate failed" });
    } finally {
      setBusyId(null);
    }
  };

  const handleSave = async (item: SocialGalleryItem) => {
    if (!canWrite) return;
    const draft = drafts[item.id];
    if (!draft) return;
    setBusyId(item.id);
    setMessage(null);
    try {
      const result = await updateSocialGalleryItemApi({
        id: item.id,
        caption: draft.caption,
        hashtags: draft.hashtags,
      });
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? result.item : entry)));
      setMessage({ type: "success", text: "Caption saved." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusyId(null);
    }
  };

  const handlePublish = async (item: SocialGalleryItem, dryRun: boolean) => {
    if (!canWrite) return;
    setBusyId(item.id);
    setMessage(null);
    try {
      const result = await publishSocialGalleryItemApi({ id: item.id, dryRun });
      if (dryRun) {
        setMessage({
          type: "success",
          text: `Dry run: ${result.summary.sent} would send, ${result.summary.skipped} skipped, ${result.summary.failed} failed.`,
        });
      } else {
        setMessage({
          type: "success",
          text: `Published to ${result.summary.sent} channel(s).`,
        });
        load();
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Publish failed" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Deploy social gallery
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Lorapok release cards queued after deploy (DEPLOY-03). Generate branded SVG assets, edit captions,
            then publish to every configured social channel in one click.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm hover:bg-white/5"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {message && (
        <div className="mb-4">
          <Notification tone={message.type} message={message.text} onDismiss={() => setMessage(null)} />
        </div>
      )}

      {loading ? (
        <LorapokLarvaeLoader label="Loading social gallery…" />
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          No gallery jobs yet. Successful marketplace deploys queue items automatically via DEPLOY-03.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            const draft = drafts[item.id] ?? { caption: item.caption, hashtags: item.hashtags ?? "" };
            const busy = busyId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-elevated)_80%,transparent)]"
              >
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-3"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                >
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                  <span className="font-medium">{item.tag}</span>
                  <span className="text-sm text-[var(--color-muted)] truncate flex-1">{item.caption}</span>
                  {item.publishedAt && (
                    <Badge variant="synced">Published</Badge>
                  )}
                </button>

                {expanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-[var(--color-border)]">
                    {item.imageUrl && item.status === "ready" && (
                      <div className="rounded-lg overflow-hidden border border-[var(--color-border)] bg-black/20">
                        <img
                          src={`${item.imageUrl}${item.imageUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(item.updatedAt)}`}
                          alt={`Release card for ${item.tag}`}
                          className="w-full max-w-md aspect-square object-cover"
                        />
                      </div>
                    )}

                    <label className="block text-sm">
                      <span className="font-medium mb-1 block">Caption</span>
                      <textarea
                        className="w-full min-h-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                        value={draft.caption}
                        disabled={!canWrite}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, caption: event.target.value },
                          }))
                        }
                      />
                    </label>

                    <label className="block text-sm">
                      <span className="font-medium mb-1 block">Hashtags</span>
                      <input
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                        value={draft.hashtags}
                        disabled={!canWrite}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, hashtags: event.target.value },
                          }))
                        }
                      />
                    </label>

                    {item.error && (
                      <p className="text-sm text-[var(--color-danger)]">{item.error}</p>
                    )}

                    {canWrite && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSave(item)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm hover:bg-white/5 disabled:opacity-50"
                        >
                          Save caption
                        </button>
                        <button
                          type="button"
                          disabled={busy || item.status === "generating"}
                          onClick={() => handleGenerate(item)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-accent)] text-sm text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] disabled:opacity-50"
                        >
                          <Wand2 size={16} aria-hidden="true" />
                          {item.status === "ready" ? "Regenerate asset" : "Generate asset"}
                        </button>
                        <button
                          type="button"
                          disabled={busy || item.status !== "ready"}
                          onClick={() => handlePublish(item, true)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm hover:bg-white/5 disabled:opacity-50"
                        >
                          <ImageIcon size={16} aria-hidden="true" />
                          Dry-run publish
                        </button>
                        <button
                          type="button"
                          disabled={busy || item.status !== "ready"}
                          onClick={() => handlePublish(item, false)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-sm text-white hover:opacity-90 disabled:opacity-50"
                        >
                          <Send size={16} aria-hidden="true" />
                          Publish all channels
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
