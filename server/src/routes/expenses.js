import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { buildExpenseFilter } from './expenseFilter.js';

const router = Router();
router.use(requireAuth);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD ko\'rinishida bo\'lishi kerak.')
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00`).getTime()), 'Sana noto\'g\'ri.');

const expenseSchema = z.object({
  expense_date: isoDate,
  description: z.string().min(1),
  category: z.enum(['Ijara', 'Ish haqi', 'Kommunal xizmatlar', 'Transport', 'Boshqa']),
  amount: z.number().positive(),
});

router.get(
  '/',
  asyncHandler((req, res) => {
    const { where, params } = buildExpenseFilter(req.query);
    const rows = db
      .prepare(`SELECT * FROM expenses ${where} ORDER BY expense_date DESC, id DESC`)
      .all(...params);
    res.json(rows);
  })
);

router.post(
  '/',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Harajat ma\'lumotlari noto\'g\'ri.', details: parsed.error.flatten() });
    }
    const { expense_date, description, category, amount } = parsed.data;
    const result = db
      .prepare(
        `INSERT INTO expenses (expense_date, description, category, amount) VALUES (?, ?, ?, ?)`
      )
      .run(expense_date, description, category, amount);
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(expense);
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Harajat topilmadi.' });
    db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  })
);

export default router;
