-- Schema for isolated checkout test inventory. Do not seed a live database with test data.
CREATE TABLE inventory (sku TEXT PRIMARY KEY, quantity INTEGER NOT NULL CHECK(quantity >= 0));
CREATE TABLE reservations (id TEXT PRIMARY KEY, items TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('held','paid','released')));

-- Test counterpart of the existing SweForms order table.
CREATE TABLE orders (id INTEGER PRIMARY KEY, session_id TEXT NOT NULL UNIQUE, payment_id TEXT NOT NULL, paid_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','packed','shipped')), updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)));
