// Symbol currencies lead the amount ($1 234), word currencies follow it
// (1 234 so'm) — the same number formatted the way each is actually written.
const LEADING_SYMBOLS = new Set(['$', '€', '£']);

export function formatMoney(value, currency = "so'm", decimals = 0) {
  const n = Number(value) || 0;
  const amount = n.toLocaleString('uz-UZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return LEADING_SYMBOLS.has(currency) ? `${currency}${amount}` : `${amount} ${currency}`;
}

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
