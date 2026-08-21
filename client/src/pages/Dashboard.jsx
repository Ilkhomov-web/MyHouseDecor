import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useMoney } from '../context/SettingsContext';
import StatCard from '../components/StatCard';
import { IconBox, IconWallet, IconCart, IconChart, IconAlert, IconTrendUp, IconClock } from '../components/icons/Icons';
import { formatDate } from '../utils/format';

const PERIODS = [
  { value: 'daily', label: 'Bugun' },
  { value: 'weekly', label: '7 kun' },
  { value: 'monthly', label: '30 kun' },
  { value: 'all', label: 'Hammasi' },
];

const PERIOD_NOTE = {
  daily: 'bugungi',
  weekly: "so'nggi 7 kunlik",
  monthly: "so'nggi 30 kunlik",
  all: 'umumiy',
};

export default function Dashboard() {
  const { user } = useAuth();
  const money = useMoney();
  const [period, setPeriod] = useState('monthly');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    api
      .get(`/analytics/dashboard?period=${period}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  if (error) return <div className="page"><div className="error-banner">{error}</div></div>;
  if (!data) return <div className="page"><div className="empty-state">Yuklanmoqda...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Xush kelibsiz, {user?.name?.split(' ')[0]}</div>
          <div className="page-subtitle">Do'koningizning {PERIOD_NOTE[period]} holati</div>
        </div>
        <div className="segmented" role="group">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={period === p.value ? 'active' : ''}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          icon={IconCart}
          label="Tushum"
          value={money(data.totalRevenue)}
          delta={`${data.salesCount} ta sotuv`}
        />
        <StatCard icon={IconChart} label="Harajatlar" value={money(data.totalExpenses)} />
        <StatCard
          icon={IconTrendUp}
          label="Sof foyda"
          value={money(data.netProfit)}
          delta={data.netProfit >= 0 ? 'Foydali' : 'Zararda'}
          deltaType={data.netProfit >= 0 ? 'positive' : 'negative'}
        />
        {data.outstandingDebt > 0 && (
          <StatCard
            icon={IconClock}
            label="Qarzdorlik"
            value={money(data.outstandingDebt)}
            delta={`${data.debtCount} ta to'lanmagan`}
            deltaType="negative"
          />
        )}
        {/* Stock figures describe the shop right now, so the period filter
            deliberately does not apply to them. */}
        <StatCard icon={IconBox} label="Mahsulotlar soni" value={data.productCount} delta="joriy holat" />
        <StatCard icon={IconWallet} label="Ombor qiymati" value={money(data.inventoryValue)} delta="joriy holat" />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <h3>
              <span className="flex items-center gap-2">
                <IconAlert size={16} />
                Kam qolgan mahsulotlar
              </span>
            </h3>
            <Link to="/products" className="btn btn-ghost btn-sm">
              Barchasi
            </Link>
          </div>
          {data.lowStockProducts.length === 0 ? (
            <div className="empty-state">Kam qolgan mahsulot yo'q</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mahsulot</th>
                    <th>Qoldiq</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowStockProducts.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>
                        <span className="badge badge-negative">{p.stock} dona</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>So'nggi sotuvlar</h3>
            <Link to="/sales" className="btn btn-ghost btn-sm">
              Barchasi
            </Link>
          </div>
          {data.recentSales.length === 0 ? (
            <div className="empty-state">Bu davrda sotuvlar yo'q</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mahsulot</th>
                    <th>Sana</th>
                    <th>Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map((s) => (
                    <tr key={s.id}>
                      <td>{s.product_name}</td>
                      <td className="text-muted">{formatDate(s.sale_date)}</td>
                      <td>{money(s.final_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
