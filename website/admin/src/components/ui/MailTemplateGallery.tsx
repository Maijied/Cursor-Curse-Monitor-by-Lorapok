import { useAuthSession } from "../../lib/auth-context";
import { useCallback, useEffect, useState } from "react";
import { Eye, Mail, Sparkles } from "lucide-react";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import { fetchMailGalleryApi, type MailGalleryPreview, type MailGalleryTemplate } from "../../lib/api";
import { Link } from "react-router-dom";

/**
 * Lorapok mail template gallery — HTML/text previews aligned with messageCatalog (MAIL-13).
 */
export default function MailTemplateGallery() {
  const { hasPermission } = useAuthSession();
  const canSend = hasPermission("mail.send");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [transport, setTransport] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Array<{ template: MailGalleryTemplate; preview: MailGalleryPreview }>>([]);
  const [expandedId, setExpandedId] = useState<string | null>("subscribe-welcome");
  const [previewTab, setPreviewTab] = useState<"html" | "text">("html");

  const load = useCallback(() => {
    setLoading(true);
    fetchMailGalleryApi()
      .then((data) => {
        setPreviews(data.previews ?? []);
        setTransport(data.transport?.transport ?? null);
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Mail template gallery
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Branded HTML aligned with <code className="text-xs">messageCatalog</code> — subscribe welcome, release
            digest, notices, and delivery tests. Subscriber merge tags: name, platform, stats, unsubscribe.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={transport ? "synced" : "warn"}>{transport ? `Transport: ${transport}` : "Transport unknown"}</Badge>
          <Badge variant="synced">MAIL-13</Badge>
        </div>
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      {loading ? (
        <div className="flex items-center gap-3 py-6 justify-center text-sm text-[var(--color-muted)]">
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading mail template gallery" className="!flex-row !gap-3" />
          <span>Loading template previews…</span>
        </div>
      ) : (
        <div className="space-y-3">
          {previews.map(({ template, preview }) => {
            const expanded = expandedId === template.id;
            return (
              <div
                key={template.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[var(--color-border)]">
                  <div>
                    <p className="font-medium">{template.label}</p>
                    <p className="text-xs text-[var(--color-muted)]">{template.description}</p>
                    <p className="text-xs text-[var(--color-muted)] mt-1 font-[family-name:var(--font-mono)]">
                      Subject: {preview.subject}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{template.category}</Badge>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : template.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm hover:bg-white/5"
                    >
                      <Eye size={14} aria-hidden="true" />
                      {expanded ? "Hide" : "Preview"}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="p-4 space-y-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewTab("html")}
                        className={`px-3 py-1.5 rounded-lg text-sm border ${
                          previewTab === "html"
                            ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                            : "border-[var(--color-border)] text-[var(--color-muted)]"
                        }`}
                      >
                        HTML
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab("text")}
                        className={`px-3 py-1.5 rounded-lg text-sm border ${
                          previewTab === "text"
                            ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                            : "border-[var(--color-border)] text-[var(--color-muted)]"
                        }`}
                      >
                        Plain text
                      </button>
                    </div>
                    {previewTab === "html" ? (
                      <iframe
                        title={`${template.label} HTML preview`}
                        srcDoc={preview.html}
                        sandbox=""
                        className="w-full min-h-[24rem] h-[28rem] rounded-xl border border-[var(--color-border)] bg-white"
                      />
                    ) : (
                      <pre className="text-sm whitespace-pre-wrap rounded-xl border border-[var(--color-border)] bg-black/20 p-4 text-[var(--color-text)] font-[family-name:var(--font-mono)] max-h-[28rem] overflow-auto">
                        {preview.text}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
        <Mail size={14} aria-hidden="true" />
        {canSend ? (
          <Link to="/dashboard/mailbox" className="text-[var(--color-accent)] hover:underline">
            Open Mailbox
          </Link>
        ) : (
          <span>Requires mail.send to send live tests from Mailbox.</span>
        )}
        <span>·</span>
        <span>Dynamic subscriber tags power welcome + digest sends (MAIL-14).</span>
      </div>
    </Card>
  );
}
