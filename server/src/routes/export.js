import { Router } from 'express';
import ExcelJS from 'exceljs';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { buildSalesFilter } from './salesFilter.js';
import { buildExpenseFilter } from './expenseFilter.js';

const router = Router();
router.use(requireAuth);

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

/**
 * Amounts are exported as numbers in so'm, never as pre-formatted strings —
 * that keeps them summable in Excel. The column's number format carries the
 * currency, and a header note records the rate used for the dollar column.
 */
function moneyFormat(currency, usdRate) {
  return currency === '$'
    ? { fmt: '#,##0.00" $"', convert: (v) => Number(v || 0) / usdRate }
    : { fmt: '#,##0" so\'m"', convert: (v) => Number(v || 0) };
}

function styleSheet(ws, headerCount) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.height = 20;
  header.alignment = { vertical: 'middle' };
  for (let i = 1; i <= headerCount; i += 1) {
    header.getCell(i).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5B4FD4' },
    };
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headerCount } };
}

async function send(res, wb, filename) {
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

router.get(
  '/sales.xlsx',
  asyncHandler(async (req, res) => {
    const currency = getSetting('currency', "so'm");
    const usdRate = Number(getSetting('usd_rate', '12800')) || 12800;
    const { fmt, convert } = moneyFormat(currency, usdRate);

    const { where, params } = buildSalesFilter(req.query);
    const rows = db
      .prepare(
        `SELECT s.*, p.name AS product_name, p.cost_price AS product_cost_price
         FROM sales s JOIN products p ON p.id = s.product_id
         ${where}
         ORDER BY s.sale_date DESC, s.id DESC`
      )
      .all(...params);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'My House decor';
    const ws = wb.addWorksheet('Sotuvlar');

    ws.columns = [
      { header: '№', key: 'id', width: 7 },
      { header: 'Sana', key: 'date', width: 12 },
      { header: 'Mahsulot', key: 'product', width: 30 },
      { header: 'Miqdor', key: 'qty', width: 9 },
      { header: 'Chegirma', key: 'discount', width: 15 },
      { header: 'Summa', key: 'amount', width: 16 },
      { header: 'Foyda', key: 'profit', width: 16 },
      { header: "To'lov", key: 'payment', width: 12 },
      { header: 'Holat', key: 'state', width: 13 },
      { header: 'Mijoz', key: 'customer', width: 22 },
      { header: 'Telefon', key: 'phone', width: 16 },
      { header: 'Sotuvchi', key: 'seller', width: 20 },
    ];

    for (const s of rows) {
      const returned = s.status === 'returned';
      ws.addRow({
        id: s.id,
        date: s.sale_date,
        product: s.product_name,
        qty: s.quantity,
        discount: convert(s.discount),
        amount: convert(s.final_amount),
        // A returned sale earns nothing, so its profit column stays empty.
        profit: returned ? null : convert(s.final_amount - s.product_cost_price * s.quantity),
        payment: s.payment_status === 'debt' ? 'Qarz' : "To'langan",
        state: returned ? 'Qaytarilgan' : 'Faol',
        customer: s.customer_name || '',
        phone: s.customer_phone || '',
        seller: s.seller_name || '',
      });
    }

    ['discount', 'amount', 'profit'].forEach((key) => {
      ws.getColumn(key).numFmt = fmt;
    });
    styleSheet(ws, ws.columns.length);

    // Totals row, so the file answers "how much" without extra work.
    const active = rows.filter((s) => s.status === 'active');
    const sum = (fn) => active.reduce((a, s) => a + fn(s), 0);
    ws.addRow({});
    const totals = ws.addRow({
      product: `JAMI (faol ${active.length} ta)`,
      amount: convert(sum((s) => s.final_amount)),
      profit: convert(sum((s) => s.final_amount - s.product_cost_price * s.quantity)),
      payment: 'Qarz:',
      state: convert(sum((s) => (s.payment_status === 'debt' ? s.final_amount : 0))),
    });
    totals.font = { bold: true };
    totals.getCell('amount').numFmt = fmt;
    totals.getCell('profit').numFmt = fmt;
    totals.getCell('state').numFmt = fmt;

    await send(res, wb, `sotuvlar-${stamp()}.xlsx`);
  })
);

router.get(
  '/products.xlsx',
  asyncHandler(async (req, res) => {
    const currency = getSetting('currency', "so'm");
    const usdRate = Number(getSetting('usd_rate', '12800')) || 12800;
    const { fmt, convert } = moneyFormat(currency, usdRate);

    const rows = db.prepare('SELECT * FROM products ORDER BY name COLLATE NOCASE').all();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'My House decor';
    const ws = wb.addWorksheet('Mahsulotlar');
    ws.columns = [
      { header: '№', key: 'id', width: 7 },
      { header: 'Nomi', key: 'name', width: 34 },
      { header: 'Kelgan narx', key: 'cost', width: 16 },
      { header: 'Sotish narxi', key: 'price', width: 16 },
      { header: 'Marja %', key: 'margin', width: 10 },
      { header: 'Qoldiq', key: 'stock', width: 9 },
      { header: 'Ombor qiymati', key: 'value', width: 18 },
    ];

    for (const p of rows) {
      ws.addRow({
        id: p.id,
        name: p.name,
        cost: convert(p.cost_price),
        price: convert(p.sale_price),
        margin: p.sale_price > 0 ? (p.sale_price - p.cost_price) / p.sale_price : 0,
        stock: p.stock,
        value: convert(p.cost_price * p.stock),
      });
    }

    ['cost', 'price', 'value'].forEach((k) => {
      ws.getColumn(k).numFmt = fmt;
    });
    ws.getColumn('margin').numFmt = '0.0%';
    styleSheet(ws, ws.columns.length);

    const totals = ws.addRow({
      name: `JAMI (${rows.length} ta)`,
      stock: rows.reduce((a, p) => a + p.stock, 0),
      value: convert(rows.reduce((a, p) => a + p.cost_price * p.stock, 0)),
    });
    totals.font = { bold: true };
    totals.getCell('value').numFmt = fmt;

    await send(res, wb, `mahsulotlar-${stamp()}.xlsx`);
  })
);

router.get(
  '/expenses.xlsx',
  asyncHandler(async (req, res) => {
    const currency = getSetting('currency', "so'm");
    const usdRate = Number(getSetting('usd_rate', '12800')) || 12800;
    const { fmt, convert } = moneyFormat(currency, usdRate);

    const { where, params } = buildExpenseFilter(req.query);
    const rows = db
      .prepare(`SELECT * FROM expenses ${where} ORDER BY expense_date DESC, id DESC`)
      .all(...params);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'My House decor';
    const ws = wb.addWorksheet('Harajatlar');
    ws.columns = [
      { header: '№', key: 'id', width: 7 },
      { header: 'Sana', key: 'date', width: 12 },
      { header: 'Tavsif', key: 'description', width: 36 },
      { header: 'Kategoriya', key: 'category', width: 20 },
      { header: 'Summa', key: 'amount', width: 16 },
    ];

    for (const e of rows) {
      ws.addRow({
        id: e.id,
        date: e.expense_date,
        description: e.description,
        category: e.category,
        amount: convert(e.amount),
      });
    }
    ws.getColumn('amount').numFmt = fmt;
    styleSheet(ws, ws.columns.length);

    const totals = ws.addRow({
      description: `JAMI (${rows.length} ta)`,
      amount: convert(rows.reduce((a, e) => a + e.amount, 0)),
    });
    totals.font = { bold: true };
    totals.getCell('amount').numFmt = fmt;

    await send(res, wb, `harajatlar-${stamp()}.xlsx`);
  })
);

export default router;
