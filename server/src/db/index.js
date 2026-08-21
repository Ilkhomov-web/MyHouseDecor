import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || './data/myhouseshop.db';
const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

export const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// --- Migrations -----------------------------------------------------------
// schema.sql only creates missing tables; columns added to a table that
// already exists on someone's disk need an explicit, idempotent ALTER.
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Tokens issued before a password change must stop working. Comparing the JWT's
// issued-at against this timestamp is what makes an admin reset take effect
// immediately instead of after the token's 7-day expiry.
addColumnIfMissing('users', 'password_changed_at', "TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'");

// Sales gained a lifecycle (active/returned) and a payment state (paid/debt).
// Existing rows are treated as active and paid, which is what they were.
addColumnIfMissing('sales', 'status', "TEXT NOT NULL DEFAULT 'active'");
addColumnIfMissing('sales', 'returned_at', 'TEXT');
addColumnIfMissing('sales', 'payment_status', "TEXT NOT NULL DEFAULT 'paid'");
addColumnIfMissing('sales', 'paid_at', 'TEXT');
addColumnIfMissing('sales', 'customer_name', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('sales', 'customer_phone', "TEXT NOT NULL DEFAULT ''");

db.exec('CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status)');
db.exec('CREATE INDEX IF NOT EXISTS idx_sales_payment ON sales(payment_status)');

// Seed default settings if missing
const defaultSettings = {
  low_stock_threshold: '5',
  currency: "so'm",
  usd_rate: '12800',
};
const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
const settingsTx = db.transaction((entries) => {
  for (const [key, value] of entries) insertSetting.run(key, value);
});
settingsTx(Object.entries(defaultSettings));

export default db;
