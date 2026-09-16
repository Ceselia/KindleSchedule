-- Cloudflare D1 建表
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time TEXT,
  title TEXT NOT NULL,
  note TEXT,
  raw TEXT,
  done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
