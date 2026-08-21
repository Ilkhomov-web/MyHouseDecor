/**
 * Timestamped copy of the shop database.
 *
 * Uses SQLite's own backup API rather than copying the file: with WAL enabled
 * a plain file copy can miss committed data still sitting in the -wal file, so
 * the copy would be silently out of date. This is safe while the server runs.
 *
 *   npm run backup              -> server/backups/ ichiga
 *   npm run backup -- D:\zaxira -> boshqa papkaga (masalan flesh disk)
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/index.js';

const KEEP = 30; // how many recent backups to retain

const target = process.argv.slice(2).find((a) => !a.startsWith('--'));
const outDir = path.resolve(target || path.join(process.cwd(), 'backups'));

fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const dest = path.join(outDir, `myhouseshop-${stamp}.db`);

try {
  await db.backup(dest);
} catch (err) {
  console.error(`\nZaxira nusxa olinmadi: ${err.message}\n`);
  process.exit(1);
}

const size = (fs.statSync(dest).size / 1024).toFixed(0);
console.log(`\n✓ Zaxira nusxa: ${dest}  (${size} KB)`);

// Prune old copies so the folder cannot grow forever.
const old = fs
  .readdirSync(outDir)
  .filter((f) => /^myhouseshop-.*\.db$/.test(f))
  .sort()
  .reverse()
  .slice(KEEP);

for (const f of old) fs.unlinkSync(path.join(outDir, f));
if (old.length) console.log(`  ${old.length} ta eski nusxa o'chirildi (oxirgi ${KEEP} tasi saqlanadi).`);

const total = fs.readdirSync(outDir).filter((f) => /^myhouseshop-.*\.db$/.test(f)).length;
console.log(`  Jami nusxalar: ${total}\n`);
console.log('Tiklash: serverni to\'xtating, nusxani server/data/myhouseshop.db ustiga ko\'chiring.\n');
