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

export function createApp() {
  const app = express();

  // Behind a reverse proxy (nginx, Render, Railway) req.ip must come from
  // X-Forwarded-For, otherwise every request looks like it originates from the
  // proxy and the login rate limiter would throttle all users as one.
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true,
    })
  );
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
