import bcrypt from 'bcryptjs';
import { db } from './index.js';

/**
 * Creates the first administrator from environment variables.
 *
 * On a hosted deployment there is no terminal attached to the database volume,
 * so `npm run setup` cannot be the only way in — a freshly deployed server
 * would have an empty users table and no way to log in. ADMIN_USERNAME and
 * ADMIN_PASSWORD close that gap.
 *
 * It only ever fires when the table is completely empty, so a redeploy can
 * never resurrect a deleted account, overwrite a changed password, or add a
 * second admin behind the owner's back. Once the shop is running the variables
 * can be removed from the host.
 */
export function bootstrapAdmin() {
  const username = (process.env.ADMIN_USERNAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const fullName = (process.env.ADMIN_NAME || '').trim() || 'Administrator';

  if (!username && !password) return;

  const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (existing > 0) return;

  if (!username || !password) {
    console.warn('[bootstrap] ADMIN_USERNAME va ADMIN_PASSWORD ikkalasi ham kerak — o\'tkazib yuborildi.');
    return;
  }
  if (!/^[a-zA-Z0-9_.-]{3,}$/.test(username)) {
    console.warn('[bootstrap] ADMIN_USERNAME noto\'g\'ri (kamida 3 ta belgi, harf/raqam/._-).');
    return;
  }
  if (password.length < 8) {
    console.warn('[bootstrap] ADMIN_PASSWORD kamida 8 belgidan iborat bo\'lishi kerak.');
    return;
  }

  db.prepare(
    `INSERT INTO users (name, username, password_hash, role, is_active, password_changed_at)
     VALUES (?, ?, ?, 'admin', 1, datetime('now'))`
  ).run(fullName, username, bcrypt.hashSync(password, 10));

  console.log(`[bootstrap] Administrator yaratildi: ${username}. Kirgach parolni almashtiring.`);
}
