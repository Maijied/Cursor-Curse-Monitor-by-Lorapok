-- Mission Control ADMIN_D1 (ccm-admin-d1)
-- Phase 2: migrate KV scatter logs + subscriber index off hot KV paths.
-- Apply: npx wrangler d1 execute ccm-admin-d1 --remote --file=./d1/schema.sql

CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  meta_json TEXT,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_system_logs_ts ON system_logs(ts DESC);

CREATE TABLE IF NOT EXISTS subscriber_index (
  email_hash TEXT PRIMARY KEY,
  subscribed_at TEXT NOT NULL,
  source TEXT,
  meta_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscriber_index_subscribed_at ON subscriber_index(subscribed_at DESC);

-- Mail messages (replaces hot KV mailbox:messages blob — one INSERT per send).
CREATE TABLE IF NOT EXISTS mail_messages (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  direction TEXT NOT NULL,
  from_addr TEXT NOT NULL,
  to_addr TEXT NOT NULL,
  subject TEXT NOT NULL,
  text_body TEXT,
  html_body TEXT,
  status TEXT NOT NULL,
  category TEXT NOT NULL,
  sent_by TEXT,
  error TEXT,
  read_flag INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mail_messages_ts ON mail_messages(ts DESC);
CREATE INDEX IF NOT EXISTS idx_mail_messages_status ON mail_messages(status);

-- Masked Resend audit (queryable; raw JSON also in STATS_R2 mail/audit/).
CREATE TABLE IF NOT EXISTS mail_audit_resend (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  transport TEXT NOT NULL,
  status TEXT NOT NULL,
  from_display TEXT NOT NULL,
  to_masked TEXT NOT NULL,
  subject_preview TEXT,
  message_id TEXT,
  category TEXT,
  sent_by_masked TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mail_audit_resend_ts ON mail_audit_resend(ts DESC);
