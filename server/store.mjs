import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY, token TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount >= 100 AND amount <= 1000000),
      reference TEXT NOT NULL UNIQUE, public_name INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected')),
      created_at TEXT NOT NULL, confirmed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);
  db.exec(`CREATE TABLE IF NOT EXISTS donation_receipts (
  donation_id TEXT PRIMARY KEY REFERENCES donations(id), phone TEXT NOT NULL,
  mime TEXT NOT NULL, data TEXT NOT NULL
);
`);
  return {
    db,
    createSession(id,expires) {db.prepare('DELETE FROM admin_sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO admin_sessions (id,expires) VALUES (?,?)').run(id,expires);},
    sessionValid(id,now) {return Boolean(db.prepare('SELECT id FROM admin_sessions WHERE id=? AND expires>?').get(id,now));},
    deleteSession(id) {db.prepare('DELETE FROM admin_sessions WHERE id=?').run(id);},
    allowRate(id,max,now) {
      db.prepare('DELETE FROM rate_limits WHERE expires<?').run(now);
      const row=db.prepare('INSERT INTO rate_limits (id,count,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').get(id,now+600000);
      return row.count<=max;
    },
    insert(d) { db.exec('BEGIN');try {db.prepare('INSERT INTO donations (id,token,name,email,amount,reference,public_name,created_at) VALUES (?,?,?,?,?,?,?,?)').run(d.id,d.token,d.name,d.email,d.amount,d.reference,d.publicName ? 1 : 0,d.createdAt);if(d.receipt)db.prepare('INSERT INTO donation_receipts (donation_id,phone,mime,data) VALUES (?,?,?,?)').run(d.id,d.receipt.phone,d.receipt.mime,d.receipt.data);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;} },
    receipt(id) {return db.prepare('SELECT mime,data FROM donation_receipts WHERE donation_id=?').get(id);},
    find(id) { return db.prepare('SELECT * FROM donations WHERE id=?').get(id); },
    confirm(id, status) { return db.prepare("UPDATE donations SET status=?, confirmed_at=? WHERE id=? AND status='pending'").run(status,status==='confirmed' ? new Date().toISOString() : null,id).changes; },
    pending() { return db.prepare("SELECT d.id,name,email,amount,reference,status,created_at,r.phone,CASE WHEN r.donation_id IS NULL THEN 0 ELSE 1 END has_slip FROM donations d LEFT JOIN donation_receipts r ON r.donation_id=d.id ORDER BY created_at DESC LIMIT 200").all(); },
    summary() {
      const totals=db.prepare("SELECT COALESCE(SUM(amount),0) amount, COUNT(*) contributions FROM donations WHERE status='confirmed'").get();
      const donors=db.prepare("SELECT id,CASE WHEN public_name=1 THEN name ELSE 'Anonymous' END name,amount,confirmed_at FROM donations WHERE status='confirmed' ORDER BY confirmed_at DESC LIMIT 50").all();
      return { amount: totals.amount, contributions: totals.contributions, seedlings: Math.floor(totals.amount / 100), target: 500, donors };
    },
    close() { db.close(); }
  };
}
