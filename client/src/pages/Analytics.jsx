import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useCurrency } from '../context/SettingsContext';

// Recharts needs literal colour values, not var(--…), so read the tokens off
// the root element — and re-read them whenever the theme attribute flips.
function useCssVar(name, fallback) {
  const { theme } = useTheme();
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (v) setValue(v);
  }, [name, theme]);
  return value;
}

// Axis labels have little room, so shorten to 1.2M / 4.4K instead of the full
// amount. Works for both currencies since the value is already converted.
function compactAxis(v) {
  const n = Math.abs(v);
  if (n >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

export default function Analytics() {
  const toast = useToast();
  const { money, fromSom } = useCurrency();
  const [granularity, setGranularity] = useState('weekly');
  const [revenueSeries, setRevenueSeries] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState([]);
  const [profitSummary, setProfitSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  const accent = useCssVar('--accent', '#7c6cf0');
  const border = useCssVar('--border', '#333');
  const textMuted = useCssVar('--text-muted', '#888');
  const surface = useCssVar('--surface', '#1c1c22');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/analytics/revenue-series?granularity=${granularity}`),
      api.get('/analytics/top-products'),
      api.get('/analytics/expense-breakdown'),
      api.get('/analytics/profit-summary'),
    ])
      .then(([rev, top, exp, profit]) => {
        setRevenueSeries(rev);
        setTopProducts(top);
        setExpenseBreakdown(exp);
        setProfitSummary(profit);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [granularity]);

  const maxExpense = useMemo(
    () => Math.max(1, ...expenseBreakdown.map((e) => e.total)),
    [expenseBreakdown]
  );

  const latestProfit = profitSummary[profitSummary.length - 1];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Analitika</div>
          <div className="page-subtitle">Sotuvlar va foyda tahlili</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Tushum dinamikasi</h3>
          <div className="segmented">
            <button
              className={granularity === 'weekly' ? 'active' : ''}
              onClick={() => setGranularity('weekly')}
            >
              Haftalik
            </button>
            <button
              className={granularity === 'monthly' ? 'active' : ''}
              onClick={() => setGranularity('monthly')}
            >
              Oylik
            </button>
          </div>
        </div>
        <div className="card-pad" style={{ height: 300 }}>
          {loading ? (
            <div className="empty-state">Yuklanmoqda...</div>
          ) : revenueSeries.length === 0 ? (
            // Without this the card is just a large blank area on a new shop,
            // which reads as a broken chart rather than "no sales yet".
            <div className="empty-state">Hali sotuvlar yo'q</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {/* Bars stay in so'm — only the labels are converted, so the
                  tooltip's money() is not applied on top of a converted value. */}
              <BarChart data={revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke={border} vertical={false} />
                <XAxis dataKey="period" stroke={textMuted} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke={textMuted}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => compactAxis(fromSom(v))}
                />
                <Tooltip
                  formatter={(v) => money(v)}
                  contentStyle={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, color: 'inherit' }}
                />
                <Bar dataKey="revenue" fill={accent} radius={[6, 6, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <h3>Eng ko'p sotilgan mahsulotlar</h3>
          </div>
          {topProducts.length === 0 ? (
            <div className="empty-state">Ma'lumot yo'q</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mahsulot</th>
                    <th>Sotilgan</th>
                    <th>Tushum</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>{p.units_sold} dona</td>
                      <td>{money(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h3 style={{ marginBottom: 16 }}>Harajatlar taqsimoti</h3>
          {expenseBreakdown.length === 0 ? (
            <div className="empty-state">Ma'lumot yo'q</div>
          ) : (
            <div className="flex flex-col gap-4">
              {expenseBreakdown.map((e) => (
                <div key={e.category}>
                  <div className="flex justify-between" style={{ marginBottom: 6, fontSize: 13.5 }}>
                    <span style={{ fontWeight: 600 }}>{e.category}</span>
                    <span className="text-muted">{money(e.total)}</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${(e.total / maxExpense) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {latestProfit && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">So'nggi oy tushumi</div>
            <div className="stat-value">{money(latestProfit.revenue)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">So'nggi oy harajati</div>
            <div className="stat-value">{money(latestProfit.expenses)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">So'nggi oy sof foydasi</div>
            <div className="stat-value">{money(latestProfit.net_profit)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
