import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

const productSchema = z.object({
  name: z.string().min(1),
  cost_price: z.number().nonnegative(),
  sale_price: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
});

function withMargin(p) {
  // `category` is dropped from the payload: databases created before it was
  // removed still carry the column, and SELECT * would otherwise ship a field
  // nothing reads.
  const { category, ...rest } = p;
  const margin = rest.sale_price > 0 ? (rest.sale_price - rest.cost_price) / rest.sale_price : 0;
  return { ...rest, margin };
}

router.get(
  '/',
  asyncHandler((req, res) => {
    const rows = db.prepare('SELECT * FROM products ORDER BY name COLLATE NOCASE').all();
    res.json(rows.map(withMargin));
  })
);

router.post(
  '/',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Mahsulot ma\'lumotlari noto\'g\'ri.', details: parsed.error.flatten() });
    }
    const { name, cost_price, sale_price, stock } = parsed.data;
    const result = db
      .prepare('INSERT INTO products (name, cost_price, sale_price, stock) VALUES (?, ?, ?, ?)')
      .run(name, cost_price, sale_price, stock);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(withMargin(product));
  })
);

router.put(
  '/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Mahsulot ma\'lumotlari noto\'g\'ri.', details: parsed.error.flatten() });
    }
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Mahsulot topilmadi.' });

    const merged = { ...existing, ...parsed.data };
    db.prepare(
      `UPDATE products SET name = ?, cost_price = ?, sale_price = ?, stock = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(merged.name, merged.cost_price, merged.sale_price, merged.stock, req.params.id);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(withMargin(product));
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Mahsulot topilmadi.' });

    const saleCount = db.prepare('SELECT COUNT(*) AS c FROM sales WHERE product_id = ?').get(req.params.id).c;
    if (saleCount > 0) {
      return res.status(409).json({ error: 'Bu mahsulot bo\'yicha sotuvlar mavjud, avval ularni o\'chiring.' });
    }
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  })
);

export default router;
