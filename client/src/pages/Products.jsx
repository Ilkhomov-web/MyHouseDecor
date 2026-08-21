import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCurrency, useSettings } from '../context/SettingsContext';
import Modal from '../components/Modal';
import { IconPlus, IconEdit, IconTrash, IconSearch, IconBox, IconDownload } from '../components/icons/Icons';
import { formatPercent } from '../utils/format';

const emptyForm = { name: '', cost_price: '', sale_price: '', stock: '' };

export default function Products() {
  const { user } = useAuth();
  const toast = useToast();
  const { money, toSom, toInput, currency, step } = useCurrency();
  const { lowStockThreshold } = useSettings();
  const isAdmin = user?.role === 'admin';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/products')
      .then(setProducts)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.id).includes(q)
    );
  }, [products, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      cost_price: toInput(p.cost_price),
      sale_price: toInput(p.sale_price),
      stock: String(p.stock),
    });
    setFormError('');
    setModalOpen(true);
  };

  /**
   * Converts a price field back to so'm for storage. In dollar mode the shown
   * value is rounded to cents, so re-saving an untouched field would drift the
   * stored amount by a few so'm — if the text is unchanged, keep the original.
   */
  const priceToSom = (entered, originalSom) => {
    if (editing && originalSom !== undefined && entered === toInput(originalSom)) {
      return originalSom;
    }
    return toSom(entered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const payload = {
      name: form.name.trim(),
      cost_price: priceToSom(form.cost_price, editing?.cost_price),
      sale_price: priceToSom(form.sale_price, editing?.sale_price),
      stock: Number(form.stock),
    };
    if (!payload.name) return setFormError("Mahsulot nomini kiriting.");
    if (Number.isNaN(payload.cost_price) || Number.isNaN(payload.sale_price) || Number.isNaN(payload.stock)) {
      return setFormError('Narx va qoldiq raqam boʻlishi kerak.');
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        toast.success('Mahsulot yangilandi.');
      } else {
        await api.post('/products', payload);
        toast.success("Mahsulot qo'shildi.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.download('/export/products.xlsx', 'mahsulotlar.xlsx');
      toast.success('Excel fayl yuklandi.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/products/${deleteTarget.id}`);
      toast.success("Mahsulot o'chirildi.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Mahsulotlar</div>
          <div className="page-subtitle">Do'kondagi barcha mahsulotlar ro'yxati</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
            <IconDownload size={16} />
            {exporting ? 'Tayyorlanmoqda...' : 'Excel'}
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openCreate}>
              <IconPlus size={16} />
              Mahsulot qo'shish
            </button>
          )}
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <IconSearch size={16} />
          <input
            className="input"
            placeholder="Nomi yoki ID bo'yicha qidirish..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="text-muted" style={{ fontSize: 13 }}>
          Jami: {filtered.length} ta mahsulot
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <IconBox size={28} />
            <div style={{ marginTop: 8 }}>Mahsulot topilmadi</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nomi</th>
                  <th>Kelgan narx</th>
                  <th>Sotish narxi</th>
                  <th>Marja</th>
                  <th>Qoldiq</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{money(p.cost_price)}</td>
                    <td>{money(p.sale_price)}</td>
                    <td>
                      <span className="badge badge-accent">{formatPercent(p.margin)}</span>
                    </td>
                    <td>
                      <span className={`badge ${p.stock <= lowStockThreshold ? 'badge-negative' : 'badge-neutral'}`}>
                        {p.stock} dona
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(p)} title="Tahrirlash">
                            <IconEdit size={16} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => setDeleteTarget(p)}
                            title="O'chirish"
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal
          title={editing ? 'Mahsulotni tahrirlash' : "Yangi mahsulot qo'shish"}
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
            <div className="field">
              <label>Mahsulot nomi</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="masalan: Gilam 'Klassik' 2x3"
              />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Kelgan narx ({currency})</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step={step}
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Sotish narxi ({currency})</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step={step}
                  value={form.sale_price}
                  onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Qoldiq (dona)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Mahsulotni o'chirish"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                Bekor qilish
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                O'chirish
              </button>
            </>
          }
        >
          <p>
            <strong>{deleteTarget.name}</strong> mahsulotini rostdan ham o'chirmoqchimisiz? Bu amalni ortga qaytarib
            bo'lmaydi.
          </p>
        </Modal>
      )}
    </div>
  );
}
