import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get(
  '/',
  asyncHandler((req, res) => {
    const rows = db.prepare('SELECT id, name, username, role, is_active, created_at FROM users ORDER BY id').all();
    res.json(rows);
  })
);

const createSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(['admin', 'sotuvchi']).default('sotuvchi'),
});

router.post(
  '/',
  asyncHandler((req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Foydalanuvchi ma\'lumotlari noto\'g\'ri.', details: parsed.error.flatten() });
    }
    const { name, username, password, role } = parsed.data;
    const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
    if (existing) return res.status(409).json({ error: 'Bu login band.' });

    const hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name, username, hash, role);
    const user = db
      .prepare('SELECT id, name, username, role, is_active, created_at FROM users WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(user);
  })
);

const resetPasswordSchema = z.object({
  new_password: z.string().min(6, 'Parol kamida 6 belgidan iborat bo\'lishi kerak'),
});

router.put(
  '/:id/password',
  asyncHandler((req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Parol noto\'g\'ri.',
      });
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });

    // Changing your own password must go through the profile flow, which
    // verifies the current one — resetting it here would skip that check.
    if (user.id === req.user.id) {
      return res.status(400).json({
        error: 'O\'z parolingizni Profil sahifasidan o\'zgartiring.',
      });
    }

    // Bumping password_changed_at ends the target's active sessions at once.
    db.prepare(
      `UPDATE users SET password_hash = ?, password_changed_at = datetime('now') WHERE id = ?`
    ).run(bcrypt.hashSync(parsed.data.new_password, 10), user.id);

    res.json({ ok: true });
  })
);

router.put(
  '/:id/toggle-active',
  asyncHandler((req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'O\'zingizni faolsizlantira olmaysiz.' });
    }
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(user.is_active ? 0 : 1, user.id);
    res.json({ ok: true });
  })
);

router.delete(
  '/:id',
  asyncHandler((req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'O\'zingizni o\'chira olmaysiz.' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    res.json({ ok: true });
  })
);

export default router;
