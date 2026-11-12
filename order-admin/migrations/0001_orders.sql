CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  payment_id TEXT NOT NULL,
  paid_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'packed', 'shipped')),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
);

CREATE INDEX orders_status_updated ON orders (status, updated_at DESC, id DESC);
