import jwt from 'jsonwebtoken';

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const DEV_FALLBACK = 'dev-only-insecure-secret';

function resolveSecret() {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret || secret.includes('change-this')) {
    if (isProd) {
      throw new Error(
        'JWT_SECRET sozlanmagan. Production uchun .env faylida uzun tasodifiy qiymat belgilang.'
      );
    }
    console.warn(
      '[xavfsizlik] JWT_SECRET sozlanmagan — vaqtinchalik dev kaliti ishlatilmoqda. Production uchun .env da belgilang.'
    );
    return DEV_FALLBACK;
  }
  if (isProd && secret.length < 32) {
    throw new Error('JWT_SECRET juda qisqa — kamida 32 belgi bo\'lishi kerak.');
  }
  return secret;
}

const SECRET = resolveSecret();

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
