import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import saleRoutes from './routes/sales.js';
import expenseRoutes from './routes/expenses.js';
import analyticsRoutes from './routes/analytics.js';
import settingsRoutes from './routes/settings.js';
import exportRoutes from './routes/export.js';
import userRoutes from './routes/users.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

const stripSlash = (s) => s.trim().replace(/\/+$/, '');

/**
 * CORS origin checker.
 *
 * CLIENT_ORIGIN holds a comma-separated list because a Vercel project has more
 * than one hostname: the production domain plus a fresh one for every preview
 * deployment. An entry may start with `*.` to cover those previews, e.g.
 * `https://*.vercel.app`.
 *
 * Rejection returns "no CORS headers" rather than an error — throwing here
 * would turn a blocked origin into a 500 in the server log.
 */
function originAllowList() {
  const patterns = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(stripSlash)
    .filter(Boolean);

  const matches = (origin) =>
    patterns.some((p) => {
      if (!p.includes('*')) return p === origin;
      const [scheme, host] = p.split('://');
      const suffix = host.replace(/^\*/, '');
      return origin.startsWith(`${scheme}://`) && origin.endsWith(suffix);
    });

  return (origin, cb) => {
    // Same-origin requests, curl and health checks carry no Origin header.
    if (!origin) return cb(null, true);
    return cb(null, matches(stripSlash(origin)));
  };
}

export function createApp() {
  const app = express();

  // Behind a reverse proxy (nginx, Render, Railway) req.ip must come from
  // X-Forwarded-For, otherwise every request looks like it originates from the
  // proxy and the login rate limiter would throttle all users as one.
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  app.use(cors({ origin: originAllowList(), credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ ok: true, name: 'MyhouseShop CRM API' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/sales', saleRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api/users', userRoutes);

  app.use('/api', notFoundHandler);

  // In production the built SPA is served by this same server, so there is one
  // origin and no CORS/proxy setup to deploy. Registered after the API routes
  // so /api/* is never swallowed by the catch-all below.
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res) => {
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  } else if (process.env.NODE_ENV === 'production') {
    console.warn(
      `[ogohlantirish] client/dist topilmadi (${CLIENT_DIST}). Avval "npm run build" ni bajaring.`
    );
  }

  app.use(errorHandler);

  return app;
}
