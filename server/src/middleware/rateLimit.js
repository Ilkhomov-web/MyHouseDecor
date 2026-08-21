import { db } from '../db/index.js';

// Login throttling backed by SQLite. Keeping the counters in the database
// (rather than a per-process Map) means a restart cannot wipe an attacker's
// budget, and several server processes sharing one database enforce one limit.

const selectStmt = db.prepare('SELECT count, reset_at FROM login_attempts WHERE key = ?');
const upsertStmt = db.prepare(
  `INSERT INTO login_attempts (key, count, reset_at) VALUES (?, 1, ?)
   ON CONFLICT(key) DO UPDATE SET
     count = CASE WHEN excluded.reset_at > login_attempts.reset_at THEN 1 ELSE login_attempts.count + 1 END,
     reset_at = CASE WHEN excluded.reset_at > login_attempts.reset_at THEN excluded.reset_at ELSE login_attempts.reset_at END`
);
const deleteStmt = db.prepare('DELETE FROM login_attempts WHERE key = ?');
const sweepStmt = db.prepare('DELETE FROM login_attempts WHERE reset_at < ?');

/**
 * Records one attempt against `key` and reports whether the caller is over
 * budget. The window restarts once the previous one has elapsed.
 */
function hit(key, windowMs, max) {
  const now = Date.now();
  const existing = selectStmt.get(key);
  const windowExpired = !existing || now > existing.reset_at;

  // A fresh window starts at `now + windowMs`; inside a live window the stored
  // reset_at is kept, which is what the CASE expressions above compare against.
  upsertStmt.run(key, windowExpired ? now + windowMs : existing.reset_at);

  const after = selectStmt.get(key);
  if (after.count > max) {
    return { blocked: true, retryAfter: Math.ceil((after.reset_at - now) / 1000) };
  }
  return { blocked: false };
}

/**
 * Login limiter.
 *
 * Shops sit behind a single NAT address, so limiting purely by IP would let one
 * employee's typos lock out every colleague. The tight budget is therefore per
 * (IP, username) — it still stops guessing against any one account — with a
 * looser IP-wide ceiling to catch someone spraying many usernames.
 */
export function loginRateLimit({
  windowMs = 15 * 60 * 1000,
  perAccount = 10,
  perIp = 60,
} = {}) {
  return (req, res, next) => {
    const ip = req.ip;
    const username = String(req.body?.username || '').toLowerCase().trim();

    const ipResult = hit(`ip:${ip}`, windowMs, perIp);
    if (ipResult.blocked) return reject(res, ipResult.retryAfter);

    if (username) {
      const acctResult = hit(`acct:${ip}:${username}`, windowMs, perAccount);
      if (acctResult.blocked) return reject(res, acctResult.retryAfter);
    }
    next();
  };
}

function reject(res, retryAfter) {
  res.set('Retry-After', String(retryAfter));
  return res.status(429).json({
    error: `Juda ko'p urinish. ${Math.max(1, Math.ceil(retryAfter / 60))} daqiqadan so'ng qayta urining.`,
  });
}

// A successful login clears that account's budget (the IP ceiling stays).
export function clearLoginAttempts(req) {
  const username = String(req.body?.username || '').toLowerCase().trim();
  if (username) deleteStmt.run(`acct:${req.ip}:${username}`);
}

// Drop expired rows so the table cannot grow without bound.
const sweep = setInterval(() => sweepStmt.run(Date.now()), 10 * 60 * 1000);
sweep.unref();
