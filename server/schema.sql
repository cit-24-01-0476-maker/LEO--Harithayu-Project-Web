CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY, token TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount >= 100 AND amount <= 1000000),
  reference TEXT NOT NULL UNIQUE, public_name INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected')),
  created_at TEXT NOT NULL, confirmed_at TEXT
);
CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
