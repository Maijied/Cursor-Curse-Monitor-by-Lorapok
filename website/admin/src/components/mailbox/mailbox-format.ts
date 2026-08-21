import type { MailboxMessage } from "../../lib/api";

export function formatMailboxAddress(row: MailboxMessage): string {
  return row.direction === "outbound" ? `→ ${row.to}` : `← ${row.from}`;
}
