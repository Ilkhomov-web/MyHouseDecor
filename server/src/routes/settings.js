import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler((req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  })
);

// Currency is a switch in the UI, not free text — keep the API in step so a
// stray value cannot land in the database and show up beside every amount.
export const CURRENCIES = ["so'm", '$'];

const settingsSchema = z.object({
  low_stock_threshold: z
    .string()
    .regex(/^\d+$/, 'Chegara musbat butun son bo\'lishi kerak')
    .optional(),
  currency: z.enum(CURRENCIES).optional(),
  // Amounts are stored in so'm; this is the hand-entered rate used to show
  // them in dollars. Must be > 0 or every converted figure becomes Infinity.
  usd_rate: z
    .string()
    .refine((s) => Number(s) > 0, 'Kurs noldan katta bo\'lishi kerak')
    .optional(),
});

router.put(
  '/',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Sozlamalar noto\'g\'ri.',
      });
    }

    const upsert = db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );
    const tx = db.transaction((entries) => {
      for (const [k, v] of entries) upsert.run(k, v);
    });
    tx(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const rows = db.prepare('SELECT key, value FROM settings').all();
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  })
);

export default router;
