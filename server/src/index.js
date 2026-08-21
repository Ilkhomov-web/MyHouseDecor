import 'dotenv/config';
import { createApp } from './app.js';
import { db } from './db/index.js';
import { bootstrapAdmin } from './db/bootstrap.js';

bootstrapAdmin();

const app = createApp();
const port = process.env.PORT || 4000;
// 0.0.0.0 so the shop's other computers can reach it over the LAN; set HOST to
// 127.0.0.1 to restrict the server to this machine only.
const host = process.env.HOST || '0.0.0.0';

const server = app.listen(port, host, () => {
  console.log(`MyhouseShop CRM API http://localhost:${port} manzilida ishga tushdi`);
  if (host === '0.0.0.0') {
    console.log('Tarmoqdagi boshqa kompyuterlar uchun: http://<shu-kompyuter-IP>:' + port);
  }
});

/**
 * Nobody watches the terminal in a shop, so an unexpected error must be logged
 * rather than silently taking the whole system down. The process stays up: a
 * single bad request should not close the till.
 */
process.on('unhandledRejection', (reason) => {
  console.error('[kutilmagan xato — promise]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[kutilmagan xato]', err);
});

/** Close cleanly so SQLite flushes its write-ahead log instead of leaving it. */
function shutdown(signal) {
  console.log(`\n${signal} — server to'xtatilmoqda...`);
  server.close(() => {
    try {
      db.close();
    } catch {
      // already closed
    }
    console.log("Baza yopildi. Xayr.");
    process.exit(0);
  });
  // Do not hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
