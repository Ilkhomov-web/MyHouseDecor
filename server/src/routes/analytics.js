import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

// How far back each dashboard filter reaches. `all` keeps the running totals.
const PERIODS = {
  daily: "date('now', 'localtime')",
  weekly: "date('now', 'localtime', '-6 days')",
  monthly: "date('now', 'localtime', '-29 days')",
};

router.get(
  '/dashboard',
  asyncHandler((req, res) => {
    const period = Object.hasOwn(PERIODS, req.query.period) ? req.query.period : 'all';
    // Inlining a fixed expression from PERIODS, never user input.
    const since = PERIODS[period];
    // Returned sales are excluded everywhere: the goods came back, so they are
    // neither revenue nor profit.
    const salesWhere = since
      ? `WHERE s.status = 'active' AND s.sale_date >= ${since}`
      : `WHERE s.status = 'active'`;
    const expenseWhere = since ? `WHERE expense_date >= ${since}` : '';

    const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
    const inventoryValue = db
      .prepare('SELECT COALESCE(SUM(cost_price * stock), 0) AS v FROM products')
      .get().v;

    const totalRevenue = db
      .prepare(`SELECT COALESCE(SUM(s.final_amount), 0) AS v FROM sales s ${salesWhere}`)
      .get().v;
    const totalExpenses = db
      .prepare(`SELECT COALESCE(SUM(amount), 0) AS v FROM expenses ${expenseWhere}`)
      .get().v;
    const salesCount = db
      .prepare(`SELECT COUNT(*) AS c FROM sales s ${salesWhere}`)
      .get().c;

    // Outstanding debt is reported separately rather than being deducted from
    // revenue: the sale happened, the money simply has not arrived yet.
    const outstandingDebt = db
      .prepare(
        `SELECT COALESCE(SUM(s.final_amount), 0) AS v FROM sales s
         WHERE s.status = 'active' AND s.payment_status = 'debt'`
      )
      .get().v;
    const debtCount = db
      .prepare(
        `SELECT COUNT(*) AS c FROM sales s
         WHERE s.status = 'active' AND s.payment_status = 'debt'`
      )
      .get().c;

    const salesProfitRow = db
      .prepare(
        `SELECT COALESCE(SUM(s.final_amount - p.cost_price * s.quantity), 0) AS profit
         FROM sales s JOIN products p ON p.id = s.product_id ${salesWhere}`
      )
      .get();
    const netProfit = salesProfitRow.profit - totalExpenses;

    const lowStockThreshold = Number(getSetting('low_stock_threshold', 5));
    const lowStockProducts = db
      .prepare('SELECT id, name, cost_price, sale_price, stock FROM products WHERE stock <= ? ORDER BY stock ASC')
      .all(lowStockThreshold);

    const recentSales = db
      .prepare(
        `SELECT s.*, p.name AS product_name FROM sales s JOIN products p ON p.id = s.product_id
         ${salesWhere}
         ORDER BY s.sale_date DESC, s.id DESC LIMIT 8`
      )
      .all();

    res.json({
      period,
      productCount,
      inventoryValue,
      totalRevenue,
      totalExpenses,
      netProfit,
      salesCount,
      outstandingDebt,
      debtCount,
      lowStockProducts,
      recentSales,
      currency: getSetting('currency', "so'm"),
    });
  })
);

router.get(
  '/revenue-series',
  asyncHandler((req, res) => {
    const granularity = req.query.granularity === 'monthly' ? 'monthly' : 'weekly';
    let rows;
    if (granularity === 'monthly') {
      rows = db
        .prepare(
          `SELECT strftime('%Y-%m', sale_date) AS period, SUM(final_amount) AS revenue
           FROM sales WHERE status = 'active' GROUP BY period ORDER BY period ASC`
        )
        .all();
    } else {
      rows = db
        .prepare(
          `SELECT strftime('%Y-%W', sale_date) AS period, SUM(final_amount) AS revenue
           FROM sales WHERE status = 'active' GROUP BY period ORDER BY period ASC`
        )
        .all();
    }
    res.json(rows);
  })
);

router.get(
  '/top-products',
  asyncHandler((req, res) => {
    const rows = db
      .prepare(
        `SELECT p.id, p.name, SUM(s.quantity) AS units_sold, SUM(s.final_amount) AS revenue
         FROM sales s JOIN products p ON p.id = s.product_id
         WHERE s.status = 'active'
         GROUP BY p.id ORDER BY units_sold DESC LIMIT 10`
      )
      .all();
    res.json(rows);
  })
);

router.get(
  '/expense-breakdown',
  asyncHandler((req, res) => {
    const rows = db
      .prepare(
        `SELECT category, SUM(amount) AS total FROM expenses GROUP BY category ORDER BY total DESC`
      )
      .all();
    res.json(rows);
  })
);

router.get(
  '/profit-summary',
  asyncHandler((req, res) => {
    const rows = db
      .prepare(
        `SELECT strftime('%Y-%m', s.sale_date) AS period,
                SUM(s.final_amount) AS revenue,
                SUM(s.final_amount - p.cost_price * s.quantity) AS gross_profit
         FROM sales s JOIN products p ON p.id = s.product_id
         WHERE s.status = 'active'
         GROUP BY period ORDER BY period ASC`
      )
      .all();
    const expenseRows = db
      .prepare(`SELECT strftime('%Y-%m', expense_date) AS period, SUM(amount) AS expenses FROM expenses GROUP BY period`)
      .all();
    // Union of both sides: a month with expenses but no sales is still a real
    // (loss-making) month and must not vanish from the summary.
    const salesMap = new Map(rows.map((r) => [r.period, r]));
    const expenseMap = new Map(expenseRows.map((r) => [r.period, r.expenses]));
    const periods = [...new Set([...salesMap.keys(), ...expenseMap.keys()])].sort();

    const combined = periods.map((period) => {
      const sale = salesMap.get(period);
      const revenue = sale?.revenue || 0;
      const grossProfit = sale?.gross_profit || 0;
      const expenses = expenseMap.get(period) || 0;
      return {
        period,
        revenue,
        gross_profit: grossProfit,
        expenses,
        net_profit: grossProfit - expenses,
      };
    });
    res.json(combined);
  })
);

export default router;
