import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/index.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { loginRateLimit, clearLoginAttempts } from '../middleware/rateLimit.js';

const router = Router();

/**
 * A `Secure` cookie is only stored by the browser over HTTPS — localhost is
 * exempt, which is why this passes in development and then silently breaks a
 * shop running the server on a plain-HTTP LAN address: login returns 200, the
 * cookie is dropped, and the user bounces straight back to the login screen.
 *
 * So the flag is explicit: HTTPS deployments set COOKIE_SECURE=true (strongly
 * preferred), LAN-only installs set it to false.
 */
const COOKIE_SECURE =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';

if (process.env.NODE_ENV === 'production' && !COOKIE_SECURE) {
  console.warn(
    '[xavfsizlik] COOKIE_SECURE=false — sessiya cookie shifrlanmagan HTTP orqali yuboriladi.\n' +
      '            Bu faqat ichki tarmoq (LAN) uchun maqbul. Internetga chiqarsangiz HTTPS sozlang.'
  );
}

/**
 * `lax` is right when the API and the UI share an origin, but a split
 * deployment (UI on Vercel, API on Railway) is cross-site: the browser then
 * refuses to attach a `lax` cookie to the XHR, login returns 200 and the user
 * still bounces back to the login screen. Such a setup needs `none`, which the
 * browser only honours together with `Secure`.
 *
 * So the default follows the transport — HTTPS deployments get `none`, LAN
 * installs keep `lax` — and COOKIE_SAMESITE can override it.
 */
function resolveSameSite() {
  const requested = (process.env.COOKIE_SAMESITE || (COOKIE_SECURE ? 'none' : 'lax')).toLowerCase();
  if (requested === 'none' && !COOKIE_SECURE) {
    console.warn(
      '[xavfsizlik] COOKIE_SAMESITE=none faqat COOKIE_SECURE=true bilan ishlaydi — "lax" ga qaytarildi.'
    );
    return 'lax';
  }
  return requested;
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: resolveSameSite(),
  secure: COOKIE_SECURE,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const loginSchema = z.object({
  username: z.string().min(1, 'Login kiritilishi shart'),
  password: z.string().min(1, 'Parol kiritilishi shart'),
});

const loginLimiter = loginRateLimit();

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Login va parolni to\'g\'ri kiriting.' });
    }
    const { username, password } = parsed.data;
    const user = db
      .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
      .get(username);

    if (!user || !user.is_active || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri.' });
    }

    clearLoginAttempts(req);
    const token = signToken({ sub: user.id, role: user.role });
    res.cookie('token', token, COOKIE_OPTS);
    res.json({
      token,
      user: { id: user.id, name: user.name, username: user.username, role: user.role },
    });
  })
);

router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTS);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Joriy parolni kiriting'),
  new_password: z.string().min(6, 'Yangi parol kamida 6 belgidan iborat bo\'lishi kerak'),
});

router.put(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Parol ma\'lumotlari noto\'g\'ri.',
      });
    }
    const { current_password, new_password } = parsed.data;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(400).json({ error: 'Joriy parol noto\'g\'ri.' });
    }
    if (bcrypt.compareSync(new_password, user.password_hash)) {
      return res.status(400).json({ error: 'Yangi parol eskisidan farq qilishi kerak.' });
    }

    db.prepare(
      `UPDATE users SET password_hash = ?, password_changed_at = datetime('now') WHERE id = ?`
    ).run(bcrypt.hashSync(new_password, 10), user.id);

    // The change invalidates every earlier token, including the one this
    // request arrived with — hand back a fresh one so the user stays signed in.
    const token = signToken({ sub: user.id, role: user.role });
    res.cookie('token', token, COOKIE_OPTS);
    res.json({ ok: true, token });
  })
);

export default router;
