CREATE TABLE IF NOT EXISTS order_details (
  session_id TEXT PRIMARY KEY,
  customer_email TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  items TEXT NOT NULL,
  total TEXT NOT NULL
);
