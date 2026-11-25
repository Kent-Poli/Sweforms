CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  order_ref TEXT NOT NULL,
  items TEXT NOT NULL,
  received_at TEXT NOT NULL,
  customer_sent INTEGER NOT NULL DEFAULT 0,
  owner_sent INTEGER NOT NULL DEFAULT 0
);
