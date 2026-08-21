import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './index.js';

const hasUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
const hasProducts = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;

if (hasUsers > 0 || hasProducts > 0) {
  console.log('Baza allaqachon ma\'lumotlarga ega — seed o\'tkazib yuborildi.');
  process.exit(0);
}

const insertUser = db.prepare(
  `INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)`
);
const users = [
  ['Admin', 'admin', 'admin123', 'admin'],
  ['Sardor Sotuvchi', 'sardor', 'sardor123', 'sotuvchi'],
];
for (const [name, username, password, role] of users) {
  insertUser.run(name, username, bcrypt.hashSync(password, 10), role);
}

const insertProduct = db.prepare(
  'INSERT INTO products (name, cost_price, sale_price, stock) VALUES (?, ?, ?, ?)'
);
const products = [
  ['Gilam "Klassik" 2x3', 850000, 1250000, 12],
  ['Gilam "Modern" 1.5x2.3', 520000, 780000, 18],
  ['Palos "Yumshoq" 2x4', 310000, 480000, 4],
  ['Yo\'lak gilami 1x3', 180000, 290000, 25],
  ['Bolalar gilami "Rangli"', 260000, 410000, 3],
  ['Devor gilami "Antik"', 640000, 990000, 7],
];
const productIds = products.map((p) => insertProduct.run(...p).lastInsertRowid);

const insertSale = db.prepare(
  `INSERT INTO sales (product_id, quantity, sale_date, discount, final_amount, seller_id, seller_name, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

const productMap = new Map(products.map((p, i) => [productIds[i], p]));
const sellers = [
  { id: 1, name: 'Admin' },
  { id: 2, name: 'Sardor Sotuvchi' },
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const today = new Date();
const salesTx = db.transaction(() => {
  for (let daysAgo = 59; daysAgo >= 0; daysAgo--) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().slice(0, 10);

    // 0-3 sales per day
    const salesToday = randInt(0, 3);
    for (let i = 0; i < salesToday; i++) {
      const pid = productIds[randInt(0, productIds.length - 1)];
      const [, , salePrice] = productMap.get(pid);
      const qty = randInt(1, 3);
      const discount = Math.random() < 0.3 ? randInt(1, 5) * 10000 : 0;
      const finalAmount = salePrice * qty - discount;
      const seller = sellers[randInt(0, sellers.length - 1)];
      insertSale.run(
        pid,
        qty,
        dateStr,
        discount,
        finalAmount,
        seller.id,
        seller.name,
        `${dateStr}T${String(randInt(9, 19)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:00`
      );
    }
  }
});
salesTx();

const insertExpense = db.prepare(
  `INSERT INTO expenses (expense_date, description, category, amount) VALUES (?, ?, ?, ?)`
);
const expenseCategories = ['Ijara', 'Ish haqi', 'Kommunal xizmatlar', 'Transport', 'Boshqa'];
const expenseSamples = [
  ['Do\'kon ijarasi - avgust', 'Ijara', 4500000],
  ['Sotuvchilar oyligi', 'Ish haqi', 6200000],
  ['Elektr energiya to\'lovi', 'Kommunal xizmatlar', 380000],
  ['Yuk tashish xizmati', 'Transport', 250000],
  ['Ofis buyumlari', 'Boshqa', 120000],
  ['Internet va aloqa', 'Kommunal xizmatlar', 200000],
  ['Reklama xarajati', 'Boshqa', 450000],
  ['Benzin xarajati', 'Transport', 180000],
  ['Ombor ijarasi', 'Ijara', 1500000],
  ['Ta\'mirlash xizmati', 'Boshqa', 320000],
];
const expTx = db.transaction(() => {
  expenseSamples.forEach(([desc, cat, amount], idx) => {
    const daysAgo = randInt(0, 55);
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    insertExpense.run(date.toISOString().slice(0, 10), desc, cat, amount);
  });
});
expTx();

console.log('Demo ma\'lumotlar muvaffaqiyatli qo\'shildi:');
console.log(`- ${users.length} foydalanuvchi (admin/admin123, sardor/sardor123)`);
console.log(`- ${products.length} mahsulot`);
console.log(`- ${db.prepare('SELECT COUNT(*) AS c FROM sales').get().c} sotuv`);
console.log(`- ${expenseSamples.length} harajat`);
