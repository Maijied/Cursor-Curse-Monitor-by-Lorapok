import { useState } from "react";
import { Check, Code, Copy, Expand, FileText, Globe, ShieldAlert, Sparkles } from "lucide-react";
import Badge from "../ui/Badge";
import type { MailboxMessage } from "../../lib/api";
import { formatMailboxAddress } from "./mailbox-format";

interface MailboxMessagePreviewProps {
  message: MailboxMessage;
  expanded?: boolean;
  onExpand?: () => void;
}

function categoryVariant(category: string): "synced" | "neutral" | "danger" | "warn" {
  if (category === "test" || category === "subscribe") return "synced";
  if (category === "invite") return "warn";
  return "neutral";
}

export default function MailboxMessagePreview({
  message,
  expanded = false,
  onExpand,
}: MailboxMessagePreviewProps) {
  const [activeTab, setActiveTab] = useState<"rendered" | "text" | "headers">("rendered");
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const isOutbound = message.direction === "outbound";
  const initials = isOutbound ? "LL" : (message.from || "U").slice(0, 2).toUpperCase();

  const iframeHeight = expanded ? "min-h-[70vh] h-[70vh]" : "min-h-[26rem] h-[32rem]";

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-bg-base)] border border-[var(--color-border)] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${
                isOutbound
                  ? "bg-gradient-to-br from-[var(--color-accent-2)] to-[var(--color-accent)] text-white"
                  : "bg-white/10 text-[var(--color-text)] border border-[var(--color-border)]"
              }`}
            >
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] leading-snug break-words">
                {message.subject || "(No subject)"}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-muted)] mt-1 font-[family-name:var(--font-mono)]">
                <span className="text-[var(--color-text)] font-medium">
                  {isOutbound ? "To:" : "From:"} {formatMailboxAddress(message)}
                </span>
                <span>·</span>
                <span>{new Date(message.ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
            </div>
          </div>

          {/* Badges & Actions */}
          <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
            <Badge variant={message.status === "failed" ? "danger" : "synced"}>
              {message.status}
            </Badge>
            <Badge variant={categoryVariant(message.category)}>
              {message.category}
            </Badge>
            {onExpand && !expanded && (
              <button
                type="button"
                onClick={onExpand}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
                title="Expand fullscreen"
              >
                <Expand size={13} />
                <span>Expand</span>
              </button>
            )}
          </div>
        </div>

        {/* Failure Diagnostic Alert */}
        {message.error && (
          <div className="mt-4 p-3 rounded-xl border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] flex items-start gap-2.5 text-xs text-[var(--color-danger)]">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Delivery Failure</p>
              <p className="mt-0.5 break-all">{message.error}</p>
            </div>
          </div>
        )}

        {/* View Mode Tabs & Copy Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[color-mix(in_srgb,var(--color-bg-elevated)_80%,transparent)] border border-[var(--color-border)] text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("rendered")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "rendered"
                  ? "bg-[var(--color-accent-2)] text-white shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5"
              }`}
            >
              <Globe size={13} />
              Rendered HTML
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("text")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "text"
                  ? "bg-[var(--color-accent-2)] text-white shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5"
              }`}
            >
              <FileText size={13} />
              Plain Text
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("headers")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "headers"
                  ? "bg-[var(--color-accent-2)] text-white shadow-sm"
                  : "text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5"
              }`}
            >
              <Code size={13} />
              Raw / Payload
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy(message.text || "", "text")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
            >
              {copied === "text" ? <Check size={13} className="text-[var(--color-neon)]" /> : <Copy size={13} />}
              {copied === "text" ? "Copied text" : "Copy text"}
            </button>
            {message.html && (
              <button
                type="button"
                onClick={() => handleCopy(message.html || "", "html")}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
              >
                {copied === "html" ? <Check size={13} className="text-[var(--color-neon)]" /> : <Code size={13} />}
                {copied === "html" ? "Copied HTML" : "Copy HTML"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Email Reading Body */}
      <div className="flex-1 min-h-0">
        {activeTab === "rendered" && (
          <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[#ffffff] shadow-inner">
            {message.html ? (
              <iframe
                title="Email HTML preview"
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'none';"><style>body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #ffffff; }</style></head><body>${message.html}</body></html>`}
                className={`w-full bg-white ${iframeHeight}`}
                sandbox="allow-same-origin"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="p-8 text-center text-slate-500 bg-slate-50">
                <Sparkles size={24} className="mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium">No HTML body provided for this message.</p>
                <p className="text-xs mt-1">Switch to the "Plain Text" tab to read message content.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "text" && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-5 overflow-y-auto max-h-[34rem] shadow-inner">
            <pre className="text-sm whitespace-pre-wrap font-[family-name:var(--font-mono)] text-[var(--color-text)] leading-relaxed selection:bg-[var(--color-accent)]">
              {message.text || "No message body."}
            </pre>
          </div>
        )}

        {activeTab === "headers" && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-5 overflow-y-auto max-h-[34rem] space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2 font-semibold">Message Envelope</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-[family-name:var(--font-mono)]">
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-[var(--color-border)]">
                  <span className="text-[var(--color-muted)] block">ID:</span>
                  <span className="text-[var(--color-text)] break-all">{message.id}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-[var(--color-border)]">
                  <span className="text-[var(--color-muted)] block">Timestamp:</span>
                  <span className="text-[var(--color-text)]">{message.ts}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-[var(--color-border)]">
                  <span className="text-[var(--color-muted)] block">Direction:</span>
                  <span className="text-[var(--color-text)]">{message.direction}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-[var(--color-border)]">
                  <span className="text-[var(--color-muted)] block">Status:</span>
                  <span className="text-[var(--color-text)]">{message.status}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2 font-semibold">Raw JSON</p>
              <pre className="text-xs p-3 rounded-lg bg-black/40 border border-[var(--color-border)] font-[family-name:var(--font-mono)] text-[var(--color-text)] overflow-x-auto">
                {JSON.stringify(message, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
