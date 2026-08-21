import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { buildSalesFilter } from './salesFilter.js';

const router = Router();
router.use(requireAuth);

// sale_date must be a real calendar date — SQLite's strftime() silently returns
// NULL for junk input, which would drop the row out of every analytics grouping.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD ko\'rinishida bo\'lishi kerak.')
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00`).getTime()), 'Sana noto\'g\'ri.');

const saleSchema = z
  .object({
    product_id: z.number().int().positive(),
    quantity: z.number().int().positive(),
    sale_date: isoDate,
    discount: z.number().nonnegative().default(0),
    payment_status: z.enum(['paid', 'debt']).default('paid'),
    customer_name: z.string().trim().max(120).default(''),
    customer_phone: z.string().trim().max(40).default(''),
    // seller_name is intentionally NOT accepted from the client — it is always
    // taken from the authenticated user so a sale cannot be attributed to someone else.
  })
  .refine((d) => d.payment_status !== 'debt' || d.customer_name.length > 0, {
    message: "Qarzga sotishda mijoz ismi majburiy.",
    path: ['customer_name'],
  });

const SELECT_SALE = `SELECT s.*, p.name AS product_name, p.cost_price AS product_cost_price
   FROM sales s JOIN products p ON p.id = s.product_id`;

router.get(
  '/',
  asyncHandler((req, res) => {
    const { where, params } = buildSalesFilter(req.query);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM sales s JOIN products p ON p.id = s.product_id ${where}`)
      .get(...params).c;

    const rows = db
      .prepare(`${SELECT_SALE} ${where} ORDER BY s.sale_date DESC, s.id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);

    // Totals describe the whole filtered set, not just the page on screen —
    // otherwise paging would appear to change the shop's takings.
    const totals = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN s.status = 'active' THEN s.final_amount ELSE 0 END), 0) AS revenue,
           COALESCE(SUM(CASE WHEN s.status = 'active' AND s.payment_status = 'debt' THEN s.final_amount ELSE 0 END), 0) AS debt,
           COALESCE(SUM(CASE WHEN s.status = 'returned' THEN s.final_amount ELSE 0 END), 0) AS returned
         FROM sales s JOIN products p ON p.id = s.product_id ${where}`
      )
      .get(...params);

    res.json({ rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), totals });
  })
);

router.get(
  '/search-products',
  asyncHandler((req, res) => {
    const q = `%${(req.query.q || '').toString().trim()}%`;
    const rows = db
      .prepare(
        `SELECT id, name, sale_price, stock FROM products
         WHERE name LIKE ? OR CAST(id AS TEXT) LIKE ?
         ORDER BY name COLLATE NOCASE LIMIT 20`
      )
      .all(q, q);
    res.json(rows);
  })
);

router.post(
  '/',
  asyncHandler((req, res) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Sotuv ma\'lumotlari noto\'g\'ri.',
        details: parsed.error.flatten(),
      });
    }
    const { product_id, quantity, sale_date, discount, payment_status, customer_name, customer_phone } =
      parsed.data;

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi.' });
    if (product.stock < quantity) {
      return res.status(409).json({ error: `Omborda yetarli mahsulot yo'q (qoldiq: ${product.stock}).` });
    }

    const gross = product.sale_price * quantity;
    if (discount > gross) {
      return res.status(400).json({ error: "Chegirma sotuv summasidan katta bo'lishi mumkin emas." });
    }
    const finalAmount = gross - discount;

    const tx = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO sales
             (product_id, quantity, sale_date, discount, final_amount, seller_id, seller_name,
              payment_status, paid_at, customer_name, customer_phone)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          product_id,
          quantity,
          sale_date,
          discount,
          finalAmount,
          req.user.id,
          req.user.name,
          payment_status,
          payment_status === 'paid' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
          customer_name,
          customer_phone
        );
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(quantity, product_id);
      return result.lastInsertRowid;
    });

    const sale = db.prepare(`${SELECT_SALE} WHERE s.id = ?`).get(tx());
    res.status(201).json(sale);
  })
);

/** Shared guard: the sale must exist and belong to the caller (or caller is admin). */
function loadOwnSale(req, res) {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) {
    res.status(404).json({ error: 'Sotuv topilmadi.' });
    return null;
  }
  if (req.user.role !== 'admin' && sale.seller_id !== req.user.id) {
    res.status(403).json({ error: "Faqat o'z sotuvingiz bilan ishlay olasiz." });
    return null;
  }
  return sale;
}

/**
 * Return (vozvrat). Restores stock and marks the row returned instead of
 * deleting it, so the event stays in the history and in the reports.
 */
router.put(
  '/:id/return',
  asyncHandler((req, res) => {
    const sale = loadOwnSale(req, res);
    if (!sale) return undefined;
    if (sale.status === 'returned') {
      return res.status(409).json({ error: 'Bu sotuv allaqachon qaytarilgan.' });
    }

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE sales SET status = 'returned', returned_at = datetime('now') WHERE id = ?`
      ).run(sale.id);
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(sale.quantity, sale.product_id);
    });
    tx();

    res.json(db.prepare(`${SELECT_SALE} WHERE s.id = ?`).get(sale.id));
  })
);

/** Clears a debt in one step — there are no partial payments by design. */
router.put(
  '/:id/pay',
  asyncHandler((req, res) => {
    const sale = loadOwnSale(req, res);
    if (!sale) return undefined;
    if (sale.status === 'returned') {
      return res.status(409).json({ error: "Qaytarilgan sotuvni to'langan deb belgilab bo'lmaydi." });
    }
    if (sale.payment_status === 'paid') {
      return res.status(409).json({ error: "Bu sotuv allaqachon to'langan." });
    }

    db.prepare(`UPDATE sales SET payment_status = 'paid', paid_at = datetime('now') WHERE id = ?`).run(
      sale.id
    );
    res.json(db.prepare(`${SELECT_SALE} WHERE s.id = ?`).get(sale.id));
  })
);

/**
 * Hard delete, admin only. This erases history, so it exists for correcting a
 * mistyped entry — a genuine customer return belongs in /return above.
 */
router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sotuv topilmadi.' });

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM sales WHERE id = ?').run(sale.id);
      // Stock was already given back when the sale was returned.
      if (sale.status !== 'returned') {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(sale.quantity, sale.product_id);
      }
    });
    tx();
    res.json({ ok: true });
  })
);

export default router;
