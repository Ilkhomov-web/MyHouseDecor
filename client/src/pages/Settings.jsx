import { useEffect, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { IconSettings } from '../components/icons/Icons';
import { formatMoney } from '../utils/format';

// Must stay in step with CURRENCIES in server/src/routes/settings.js.
const CURRENCY_OPTIONS = [
  { value: "so'm", label: "So'm (UZS)" },
  { value: '$', label: 'Dollar (USD)' },
];

export default function Settings() {
  const { settings, save, loading } = useSettings();
  const toast = useToast();

  const [threshold, setThreshold] = useState('5');
  const [currency, setCurrency] = useState("so'm");
  const [usdRate, setUsdRate] = useState('12800');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setThreshold(settings.low_stock_threshold ?? '5');
    setCurrency(settings.currency ?? "so'm");
    setUsdRate(settings.usd_rate ?? '12800');
  }, [settings]);

  const rate = Number(usdRate);
  const rateValid = rate > 0;
  const isUsd = currency === '$';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const n = Number(threshold);
    if (!Number.isInteger(n) || n < 0) {
      return setError("Chegara musbat butun son bo'lishi kerak.");
    }
    if (!CURRENCY_OPTIONS.some((o) => o.value === currency)) {
      return setError('Valyutani tanlang.');
    }
    if (!rateValid) {
      return setError("Kurs noldan katta son bo'lishi kerak.");
    }

    setSaving(true);
    try {
      await save({
        low_stock_threshold: String(n),
        currency,
        usd_rate: String(rate),
      });
      toast.success('Sozlamalar saqlandi.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Sozlamalar</div>
          <div className="page-subtitle">Do'kon tizimining umumiy parametrlari</div>
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 560 }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
          <div className="stat-icon">
            <IconSettings size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Umumiy sozlamalar</div>
            <div className="text-muted" style={{ fontSize: 13 }}>
              Bu qiymatlar barcha sahifalarga ta'sir qiladi
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className="error-banner">{error}</div>}

          <div className="field">
            <label>Kam qolgan mahsulot chegarasi (dona)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              disabled={loading}
            />
            <span className="text-muted" style={{ fontSize: 12.5 }}>
              Qoldig'i shu sondan kam yoki teng mahsulotlar "kam qolgan" deb belgilanadi.
            </span>
          </div>

          <div className="field">
            <label>Valyuta</label>
            <div className="segmented" role="group">
              {CURRENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={currency === opt.value ? 'active' : ''}
                  onClick={() => setCurrency(opt.value)}
                  disabled={loading}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="usd_rate">Dollar kursi</label>
            <div className="rate-row">
              <span className="rate-prefix">1 USD =</span>
              <input
                id="usd_rate"
                className="input"
                type="number"
                min="1"
                step="1"
                value={usdRate}
                onChange={(e) => setUsdRate(e.target.value)}
                disabled={loading}
              />
              <span className="rate-suffix">so'm</span>
            </div>
            <span className="text-muted" style={{ fontSize: 12.5 }}>
              Summalar bazada har doim so'mda saqlanadi. Dollar tanlansa shu kurs bo'yicha
              hisoblab ko'rsatiladi — kursni o'zgartirsangiz barcha sahifa darhol yangilanadi.
            </span>
          </div>

          <div className="rate-preview">
            <span className="text-muted">Namuna</span>
            <strong>
              {formatMoney(1250000, "so'm")}
              {isUsd && rateValid && (
                <>
                  {'  =  '}
                  {formatMoney(1250000 / rate, '$', 2)}
                </>
              )}
            </strong>
          </div>

          <div>
            <button type="submit" className="btn btn-primary" disabled={saving || loading}>
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
