/**
 * Account recovery from the terminal.
 *
 * There is no "forgot password" email in this system, so the fallback is
 * physical access to the machine running the server: whoever can open this
 * folder already controls the database, and proving that is the credential.
 *
 *   npm run reset-password                      -> ro'yxatni ko'rsatadi
 *   npm run reset-password -- admin yangiParol  -> parolni almashtiradi
 *   npm run reset-password -- admin yangiParol --make-admin
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [username, newPassword] = args.filter((a) => !a.startsWith('--'));

function listUsers() {
  const users = db
    .prepare('SELECT id, name, username, role, is_active FROM users ORDER BY id')
    .all();

  if (users.length === 0) {
    console.log('\nBazada foydalanuvchi yo\'q. Avval "npm run seed" ni bajaring.\n');
    return;
  }

  console.log('\nMavjud foydalanuvchilar:\n');
  for (const u of users) {
    const role = u.role === 'admin' ? 'admin   ' : 'sotuvchi';
    const state = u.is_active ? '' : '  (faol emas)';
    console.log(`  ${String(u.id).padStart(3)}  ${u.username.padEnd(16)} ${role}  ${u.name}${state}`);
  }
  console.log('\nParolni almashtirish:');
  console.log('  npm run reset-password -- <login> <yangi-parol>');
  console.log('\nAgar admin huquqi ham kerak bo\'lsa:');
  console.log('  npm run reset-password -- <login> <yangi-parol> --make-admin\n');
}

if (!username || !newPassword) {
  listUsers();
  process.exit(0);
}

if (newPassword.length < 6) {
  console.error('\nXato: parol kamida 6 belgidan iborat bo\'lishi kerak.\n');
  process.exit(1);
}

const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
if (!user) {
  console.error(`\nXato: "${username}" logini topilmadi.`);
  listUsers();
  process.exit(1);
}

const makeAdmin = flags.has('--make-admin');
const hash = bcrypt.hashSync(newPassword, 10);

// Bumping password_changed_at invalidates every token issued earlier, so a
// stolen or forgotten session cannot survive the reset.
db.prepare(
  `UPDATE users
     SET password_hash = ?,
         password_changed_at = datetime('now'),
         is_active = 1,
         role = ?
   WHERE id = ?`
).run(hash, makeAdmin ? 'admin' : user.role, user.id);

const updated = db.prepare('SELECT username, role, is_active FROM users WHERE id = ?').get(user.id);

console.log(`\n✓ "${updated.username}" uchun parol yangilandi.`);
console.log(`  Rol:   ${updated.role}`);
console.log('  Holat: faol');
console.log('  Eski sessiyalar bekor qilindi — hamma qurilmalarda qayta kirish kerak.\n');
