-- Schema for isolated checkout test inventory. Do not seed a live database with test data.
CREATE TABLE inventory (sku TEXT PRIMARY KEY, quantity INTEGER NOT NULL CHECK(quantity >= 0));
CREATE TABLE reservations (id TEXT PRIMARY KEY, items TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('held','paid','released')));
