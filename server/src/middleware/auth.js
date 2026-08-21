import { verifyToken } from '../utils/jwt.js';
import { db } from '../db/index.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ error: 'Tizimga kirish talab qilinadi.' });
  }
  try {
    const payload = verifyToken(token);
    const user = db
      .prepare(
        'SELECT id, name, username, role, is_active, password_changed_at FROM users WHERE id = ?'
      )
      .get(payload.sub);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Foydalanuvchi topilmadi yoki faol emas.' });
    }

    // Any token minted before the last password change is dead — this is what
    // makes an admin password reset log the other person out immediately
    // instead of leaving their session alive until the token expires.
    const changedAtMs = Date.parse(`${user.password_changed_at.replace(' ', 'T')}Z`);
    if (Number.isFinite(changedAtMs) && payload.iat * 1000 < changedAtMs) {
      return res.status(401).json({ error: 'Parol o\'zgartirilgan, qayta kiring.' });
    }

    delete user.password_changed_at;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessiya muddati tugagan, qayta kiring.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu amal uchun ruxsat yo\'q.' });
    }
    next();
  };
}
