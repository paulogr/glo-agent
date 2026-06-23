-- Migration number: 0001 	 2026-06-23T18:00:24.426Z

CREATE TABLE IF NOT EXISTS store (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_app (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,
  platform_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  UNIQUE (store_id, platform_id),
  FOREIGN KEY (store_id) REFERENCES store(id),
  FOREIGN KEY (platform_id) REFERENCES platform(id)
);

CREATE TABLE IF NOT EXISTS platform_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT NOT NULL,
  platform_app_id INTEGER NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  UNIQUE (store_id, platform_app_id),
  FOREIGN KEY (store_id) REFERENCES store(id),
  FOREIGN KEY (platform_app_id) REFERENCES platform_app(id)
);
