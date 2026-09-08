import type { MailboxMessage } from "../../lib/api";

export function formatMailboxAddress(row: MailboxMessage): string {
  const addr = row.direction === "outbound" ? row.to : row.from;
  return row.direction === "outbound" ? `→ ${addr}` : `← ${addr}`;
}
