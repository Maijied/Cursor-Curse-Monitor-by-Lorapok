import Badge from "../ui/Badge";
import type { MailboxMessage } from "../../lib/api";

/**
 * Selects the badge variant for a mailbox message category.
 *
 * @param category - The message category.
 * @returns `synced` for test and subscribe categories; `neutral` for all other categories.
 */
function categoryVariant(category: string): "synced" | "neutral" | "danger" {
  if (category === "test" || category === "subscribe") return "synced";
  if (category === "notice") return "neutral";
  return "neutral";
}

/**
 * Formats a mailbox message address with a direction indicator.
 *
 * @param row - The mailbox message containing the direction and address.
 * @returns The recipient address prefixed with `→` for outbound messages, or the sender address prefixed with `←` for inbound messages.
 */
export function formatMailboxAddress(row: MailboxMessage): string {
  return row.direction === "outbound" ? `→ ${row.to}` : `← ${row.from}`;
}

type MailboxMessagePreviewProps = {
  message: MailboxMessage;
  expanded?: boolean;
};

/**
 * Renders a mailbox message with its metadata, address, errors, and available content previews.
 *
 * @param message - The mailbox message to display
 * @param expanded - Whether to use expanded content previews
 */
export default function MailboxMessagePreview({ message, expanded = false }: MailboxMessagePreviewProps) {
  const iframeHeight = expanded ? "min-h-[50vh] h-[50vh]" : "h-64";
  const textMax = expanded ? "max-h-[min(40vh,24rem)]" : "max-h-48";

  return (
    <div className={`space-y-4 ${expanded ? "min-h-[60vh]" : "min-h-[12rem]"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={message.status === "failed" ? "danger" : "synced"}>{message.status}</Badge>
        <Badge variant={categoryVariant(message.category)}>{message.category}</Badge>
        <span className="text-xs text-[var(--color-muted)]">{new Date(message.ts).toLocaleString()}</span>
      </div>
      <p className="text-sm font-[family-name:var(--font-mono)] text-[var(--color-accent-2)] break-all">
        {formatMailboxAddress(message)}
      </p>
      {message.error ? (
        <p className="text-sm text-[var(--color-danger)] rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2">
          {message.error}
        </p>
      ) : null}
      {message.html ? (
        <div className={`rounded-xl border border-[var(--color-border)] overflow-hidden bg-white ${expanded ? "" : "max-h-64"}`}>
          <iframe
            title="Email HTML preview"
            srcDoc={message.html}
            className={`w-full bg-white ${iframeHeight}`}
            sandbox=""
            referrerPolicy="no-referrer"
            {...({ csp: "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'none';" } as React.IframeHTMLAttributes<HTMLIFrameElement>)}
          />
        </div>
      ) : null}
      <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-4 overflow-y-auto ${textMax}`}>
        <p className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2">Plain text</p>
        <pre className="text-sm whitespace-pre-wrap font-[family-name:var(--font-mono)] text-[var(--color-text)] leading-relaxed">
          {message.text || "No message body."}
        </pre>
      </div>
    </div>
  );
}
