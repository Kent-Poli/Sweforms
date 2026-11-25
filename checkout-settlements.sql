CREATE TABLE IF NOT EXISTS checkout_settlements (
  reservation_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  payment_id TEXT NOT NULL UNIQUE
);
