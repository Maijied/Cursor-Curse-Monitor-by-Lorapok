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
