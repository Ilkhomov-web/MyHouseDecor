import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { formatMoney } from '../utils/format';

const SettingsContext = createContext(null);

const DEFAULTS = { low_stock_threshold: '5', currency: "so'm", usd_rate: '12800' };

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSettings(DEFAULTS);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get('/settings');
      setSettings({ ...DEFAULTS, ...data });
    } catch {
      setSettings(DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (patch) => {
    const data = await api.put('/settings', patch);
    setSettings({ ...DEFAULTS, ...data });
    return data;
  };

  const currency = settings.currency || DEFAULTS.currency;
  const lowStockThreshold = Number(settings.low_stock_threshold) || 5;
  // Guard against a zero/garbage rate slipping through and producing Infinity.
  const usdRate = Number(settings.usd_rate) > 0 ? Number(settings.usd_rate) : Number(DEFAULTS.usd_rate);

  const value = useMemo(
    () => ({ settings, currency, lowStockThreshold, usdRate, loading, save, refresh }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, currency, lowStockThreshold, usdRate, loading]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings SettingsProvider ichida ishlatilishi kerak');
  return ctx;
}

/**
 * Currency helpers bound to the active settings.
 *
 * Every amount is stored in so'm — that is the single source of truth. Dollars
 * are purely a presentation layer applied at the configured manual rate, so
 * changing the rate re-prices the whole UI without touching the database.
 */
export function useCurrency() {
  const { currency, usdRate } = useSettings();
  const isUsd = currency === '$';

  return useMemo(() => {
    // so'm (stored) -> the number shown to the user
    const fromSom = (som) => (isUsd ? Number(som || 0) / usdRate : Number(som || 0));
    // What the user typed -> so'm to store. Rounded to whole so'm: there is no
    // subunit in practice, and float multiplication otherwise stores values
    // like 850500.0000000001.
    const toSom = (entered) =>
      isUsd ? Math.round(Number(entered || 0) * usdRate) : Number(entered || 0);

    const money = (som) => formatMoney(fromSom(som), currency, isUsd ? 2 : 0);

    // Value for a number input: 2 decimals in USD, whole so'm otherwise.
    const toInput = (som) => {
      if (som === '' || som === null || som === undefined) return '';
      const v = fromSom(som);
      return isUsd ? v.toFixed(2) : String(Math.round(v));
    };

    return { currency, usdRate, isUsd, money, fromSom, toSom, toInput, step: isUsd ? '0.01' : '1' };
  }, [currency, usdRate, isUsd]);
}

// Formatter only — kept for the many call sites that just render an amount.
export function useMoney() {
  const { money } = useCurrency();
  return money;
}
