import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCurrency } from '../context/SettingsContext';
import Modal from '../components/Modal';
import {
  IconPlus,
  IconTrash,
  IconSearch,
  IconCart,
  IconDownload,
  IconUndo,
  IconCheck,
} from '../components/icons/Icons';
import { formatDate, todayISO } from '../utils/format';

const emptyForm = {
  search: '',
  product: null,
  quantity: '1',
  sale_date: todayISO(),
  discount: '0',
  payment_status: 'paid',
  customer_name: '',
  customer_phone: '',
};

const emptyFilters = { from: '', to: '', status: 'active', payment: '', q: '' };

const PAGE_SIZE = 25;

export default function Sales() {
  const { user } = useAuth();
  const toast = useToast();
  const { money, toSom, currency, step } = useCurrency();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState({ rows: [], total: 0, pages: 1, totals: {} });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null); // { kind, sale }
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const searchTimer = useRef(null);
  const searchBoxRef = useRef(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    return p.toString();
  }, [filters]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get(`/sales?${queryString}&page=${page}&limit=${PAGE_SIZE}`)
      .then(setData)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [queryString, page, toast]);

  useEffect(load, [load]);

  // Any filter change invalidates the current page number.
  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  // Close the product suggestion list when clicking anywhere outside it.
  useEffect(() => {
    if (!showSuggest) return undefined;
    const onPointerDown = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowSuggest(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showSuggest]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    setSuggestions([]);
    setModalOpen(true);
  };

  const handleSearchChange = (value) => {
    setForm((f) => ({ ...f, search: value, product: null }));
    setShowSuggest(true);
    clearTimeout(searchTimer.current);
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setSuggestions(await api.get(`/sales/search-products?q=${encodeURIComponent(value.trim())}`));
      } catch {
        setSuggestions([]);
      }
    }, 220);
  };

  const pickProduct = (p) => {
    setForm((f) => ({ ...f, product: p, search: `${p.name} (#${p.id})` }));
    setShowSuggest(false);
  };

  const finalAmount = useMemo(() => {
    if (!form.product) return 0;
    const qty = Number(form.quantity) || 0;
    return Math.max(0, form.product.sale_price * qty - (toSom(form.discount) || 0));
  }, [form, toSom]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.product) return setFormError("Mahsulotni ro'yxatdan tanlang.");
    const quantity = Number(form.quantity);
    if (!quantity || quantity <= 0) return setFormError("Miqdorni to'g'ri kiriting.");
    if (quantity > form.product.stock) {
      return setFormError(`Omborda yetarli mahsulot yo'q (qoldiq: ${form.product.stock}).`);
    }
    if (form.payment_status === 'debt' && !form.customer_name.trim()) {
      return setFormError('Qarzga sotishda mijoz ismini kiriting.');
    }

    setSaving(true);
    try {
      await api.post('/sales', {
        product_id: form.product.id,
        quantity,
        sale_date: form.sale_date,
        discount: toSom(form.discount) || 0,
        payment_status: form.payment_status,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
      });
      toast.success(form.payment_status === 'debt' ? "Qarzga sotuv qo'shildi." : "Sotuv qo'shildi.");
      setModalOpen(false);
      setPage(1);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runAction = async () => {
    if (!confirm) return;
    const { kind, sale } = confirm;
    setBusy(true);
    try {
      if (kind === 'return') {
        await api.put(`/sales/${sale.id}/return`);
        toast.success("Sotuv qaytarildi, qoldiq omborga qo'shildi.");
      } else if (kind === 'pay') {
        await api.put(`/sales/${sale.id}/pay`);
        toast.success("To'langan deb belgilandi.");
      } else {
        await api.del(`/sales/${sale.id}`);
        toast.success("Yozuv o'chirildi.");
      }
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.download(`/export/sales.xlsx?${queryString}`, 'sotuvlar.xlsx');
      toast.success('Excel fayl yuklandi.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  const { rows, total, pages, totals } = data;
  const canAct = (s) => isAdmin || s.seller_id === user.id;

  const confirmText = {
    return: {
      title: 'Sotuvni qaytarish',
      body: 'mahsulot omborga qaytariladi va sotuv "qaytarilgan" deb belgilanadi. Yozuv tarixda saqlanadi.',
      btn: 'Qaytarish',
    },
    pay: { title: "To'lovni tasdiqlash", body: "qarz to'langan deb belgilanadi.", btn: 'Tasdiqlash' },
    delete: {
      title: "Yozuvni o'chirish",
      body: "yozuv butunlay o'chiriladi va tarixda qolmaydi. Mijoz mahsulotni qaytargan bo'lsa, o'chirish emas, \"Qaytarish\" amalidan foydalaning.",
      btn: "O'chirish",
    },
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Sotuvlar</div>
          <div className="page-subtitle">
            {total} ta yozuv · Tushum: {money(totals.revenue || 0)}
            {totals.debt > 0 && <> · Qarz: <strong>{money(totals.debt)}</strong></>}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
            <IconDownload size={16} />
            {exporting ? 'Tayyorlanmoqda...' : 'Excel'}
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <IconPlus size={16} />
            Sotuv qo'shish
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box">
          <IconSearch size={16} />
          <input
            className="input"
            placeholder="Mahsulot, mijoz yoki sotuvchi..."
            value={filters.q}
            onChange={(e) => setFilter({ q: e.target.value })}
          />
        </div>
        <label className="filter-field">
          <span>dan</span>
          <input
            className="input"
            type="date"
            value={filters.from}
            onChange={(e) => setFilter({ from: e.target.value })}
          />
        </label>
        <label className="filter-field">
          <span>gacha</span>
          <input
            className="input"
            type="date"
            value={filters.to}
            onChange={(e) => setFilter({ to: e.target.value })}
          />
        </label>
        <select
          className="select"
          value={filters.status}
          onChange={(e) => setFilter({ status: e.target.value })}
        >
          <option value="active">Faol sotuvlar</option>
          <option value="returned">Qaytarilganlar</option>
          <option value="">Hammasi</option>
        </select>
        <select
          className="select"
          value={filters.payment}
          onChange={(e) => setFilter({ payment: e.target.value })}
        >
          <option value="">Barcha to'lovlar</option>
          <option value="paid">To'langan</option>
          <option value="debt">Qarz</option>
        </select>
        {JSON.stringify(filters) !== JSON.stringify(emptyFilters) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilter(emptyFilters)}>
            Tozalash
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Yuklanmoqda...</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <IconCart size={28} />
            <div style={{ marginTop: 8 }}>Bu shartlarga mos sotuv topilmadi</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mahsulot</th>
                  <th>Miqdor</th>
                  <th>Sana</th>
                  <th>Summa</th>
                  <th>To'lov</th>
                  <th>Mijoz</th>
                  <th>Sotuvchi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const returned = s.status === 'returned';
                  return (
                    <tr key={s.id} className={returned ? 'row-muted' : undefined}>
                      <td style={{ fontWeight: 600 }}>
                        {s.product_name}
                        {returned && <span className="badge badge-neutral" style={{ marginLeft: 8 }}>Qaytarilgan</span>}
                      </td>
                      <td>{s.quantity} dona</td>
                      <td className="text-muted">{formatDate(s.sale_date)}</td>
                      <td>{money(s.final_amount)}</td>
                      <td>
                        {returned ? (
                          <span className="text-muted">—</span>
                        ) : s.payment_status === 'debt' ? (
                          <span className="badge badge-negative">Qarz</span>
                        ) : (
                          <span className="badge badge-positive">To'langan</span>
                        )}
                      </td>
                      <td className="text-muted">
                        {s.customer_name || '—'}
                        {s.customer_phone && (
                          <div style={{ fontSize: 12 }}>{s.customer_phone}</div>
                        )}
                      </td>
                      <td className="text-muted">{s.seller_name || '—'}</td>
                      <td>
                        <div className="flex gap-2">
                          {!returned && s.payment_status === 'debt' && canAct(s) && (
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              title="To'landi deb belgilash"
                              onClick={() => setConfirm({ kind: 'pay', sale: s })}
                            >
                              <IconCheck size={16} />
                            </button>
                          )}
                          {!returned && canAct(s) && (
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              title="Qaytarish (vozvrat)"
                              onClick={() => setConfirm({ kind: 'return', sale: s })}
                            >
                              <IconUndo size={16} />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              title="Yozuvni o'chirish"
                              onClick={() => setConfirm({ kind: 'delete', sale: s })}
                            >
                              <IconTrash size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="pager">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Oldingi
          </button>
          <span className="text-muted" style={{ fontSize: 13 }}>
            {page} / {pages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Keyingi
          </button>
        </div>
      )}

      {modalOpen && (
        <Modal
          title="Yangi sotuv qo'shish"
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                Bekor qilish
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {formError && <div className="error-banner">{formError}</div>}

            <div className="field" style={{ position: 'relative' }} ref={searchBoxRef}>
              <label>Mahsulot (nomi yoki ID)</label>
              <div className="search-box" style={{ maxWidth: 'none' }}>
                <IconSearch size={16} />
                <input
                  className="input"
                  placeholder="Qidirish uchun yozing..."
                  value={form.search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setShowSuggest(true)}
                />
              </div>
              {showSuggest && suggestions.length > 0 && (
                <div className="suggest-list">
                  {suggestions.map((p) => (
                    <div key={p.id} className="suggest-item" onClick={() => pickProduct(p)}>
                      <span>{p.name}</span>
                      <span className="text-muted">
                        {money(p.sale_price)} · {p.stock} dona
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Miqdor</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Sana</label>
                <input
                  className="input"
                  type="date"
                  value={form.sale_date}
                  onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Chegirma ({currency})</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step={step}
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>To'lov holati</label>
              <div className="segmented" role="group">
                <button
                  type="button"
                  className={form.payment_status === 'paid' ? 'active' : ''}
                  onClick={() => setForm({ ...form, payment_status: 'paid' })}
                >
                  To'landi
                </button>
                <button
                  type="button"
                  className={form.payment_status === 'debt' ? 'active' : ''}
                  onClick={() => setForm({ ...form, payment_status: 'debt' })}
                >
                  Qarzga
                </button>
              </div>
            </div>

            {form.payment_status === 'debt' && (
              <div className="form-grid">
                <div className="field">
                  <label>Mijoz ismi</label>
                  <input
                    className="input"
                    placeholder="Majburiy"
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Telefon</label>
                  <input
                    className="input"
                    placeholder="+998 ..."
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  />
                </div>
              </div>
            )}

            {form.product && (
              <div className="rate-preview">
                <span className="text-muted">Yakuniy summa</span>
                <span style={{ fontWeight: 800, fontSize: 18 }}>{money(finalAmount)}</span>
              </div>
            )}
          </form>
        </Modal>
      )}

      {confirm && (
        <Modal
          title={confirmText[confirm.kind].title}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>
                Bekor qilish
              </button>
              <button
                className={confirm.kind === 'delete' ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={runAction}
                disabled={busy}
              >
                {busy ? 'Bajarilmoqda...' : confirmText[confirm.kind].btn}
              </button>
            </>
          }
        >
          <p>
            <strong>{confirm.sale.product_name}</strong> ({money(confirm.sale.final_amount)}) —{' '}
            {confirmText[confirm.kind].body}
          </p>
        </Modal>
      )}
    </div>
  );
}
