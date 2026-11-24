-- Apply only to the production order database after verifying its backup.
CREATE TABLE IF NOT EXISTS email_deliveries (
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('customer', 'owner')),
  PRIMARY KEY (session_id, kind)
);
