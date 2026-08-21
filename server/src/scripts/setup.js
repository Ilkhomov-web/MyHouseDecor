/**
 * Prepares a clean shop for a real customer: one admin account, no demo data.
 *
 * `npm run seed` is the opposite — it fills the database with sample carpets
 * and sales for development. Handing that to a customer would leave them
 * deleting fake records on day one.
 *
 *   npm run setup -- <login> <parol> "<To'liq ism>"
 *   npm run setup -- <login> <parol> "<To'liq ism>" --reset   (hammasini tozalaydi)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [username, password, fullName] = args.filter((a) => !a.startsWith('--'));

const counts = () => ({
  users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
  products: db.prepare('SELECT COUNT(*) AS c FROM products').get().c,
  sales: db.prepare('SELECT COUNT(*) AS c FROM sales').get().c,
  expenses: db.prepare('SELECT COUNT(*) AS c FROM expenses').get().c,
});

if (!username || !password || !fullName) {
  const c = counts();
  console.log(`
Toza do'kon tayyorlash (demo ma'lumotlarsiz).

  npm run setup -- <login> <parol> "<To'liq ism>"

Misol:
  npm run setup -- rustam Parol12345 "Rustam Aliyev"

Bazada allaqachon ma'lumot bo'lsa, uni tozalab yangidan boshlash uchun:
  npm run setup -- rustam Parol12345 "Rustam Aliyev" --reset

Hozirgi holat: ${c.users} foydalanuvchi, ${c.products} mahsulot, ${c.sales} sotuv, ${c.expenses} harajat.
`);
  process.exit(0);
}

if (password.length < 8) {
  console.error("\nXato: parol kamida 8 belgidan iborat bo'lishi kerak.\n");
  process.exit(1);
}
if (!/^[a-zA-Z0-9_.-]{3,}$/.test(username)) {
  console.error('\nXato: login kamida 3 ta belgi, faqat harf/raqam/._- dan iborat bo\'lsin.\n');
  process.exit(1);
}

const before = counts();
const hasData = before.users > 0 || before.products > 0 || before.sales > 0 || before.expenses > 0;

if (hasData && !flags.has('--reset')) {
  console.error(`
Bazada allaqachon ma'lumot bor:
  ${before.users} foydalanuvchi, ${before.products} mahsulot, ${before.sales} sotuv, ${before.expenses} harajat.

Ularni o'chirib toza boshlash uchun --reset qo'shing:
  npm run setup -- ${username} <parol> "${fullName}" --reset

DIQQAT: --reset barcha sotuv, mahsulot, harajat va foydalanuvchilarni o'chiradi.
Avval "npm run backup" bilan zaxira nusxa oling.
`);
  process.exit(1);
}

const run = db.transaction(() => {
  if (flags.has('--reset')) {
    // Order matters: sales reference products and users.
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM expenses').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM login_attempts').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('sales','expenses','products','users')").run();
  }

  db.prepare(
    `INSERT INTO users (name, username, password_hash, role, is_active, password_changed_at)
     VALUES (?, ?, ?, 'admin', 1, datetime('now'))`
  ).run(fullName, username, bcrypt.hashSync(password, 10));
});

run();

const after = counts();
console.log(`
✓ Do'kon tayyor.

  Administrator: ${username}  (${fullName})
  Ma'lumotlar:   ${after.products} mahsulot, ${after.sales} sotuv, ${after.expenses} harajat

Endi mahsulotlarni Mahsulotlar sahifasidan kiritishingiz mumkin.
Parolni unutsangiz: npm run reset-password
`);
