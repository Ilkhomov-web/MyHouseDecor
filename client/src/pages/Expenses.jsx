import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCurrency } from '../context/SettingsContext';
import Modal from '../components/Modal';
import DateRangePicker from '../components/DateRangePicker';
import { IconPlus, IconTrash, IconWallet, IconDownload } from '../components/icons/Icons';
import { formatDate, todayISO } from '../utils/format';

const CATEGORIES = ['Ijara', 'Ish haqi', 'Kommunal xizmatlar', 'Transport', 'Tovar', 'Boshqa'];
const emptyForm = { expense_date: todayISO(), description: '', category: CATEGORIES[0], amount: '' };

export default function Expenses() {
  const { user } = useAuth();
  const toast = useToast();
  const { money, toSom, currency, step } = useCurrency();
  const isAdmin = user?.role === 'admin';

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' });

  // Ro'yxat ham, Excel eksport ham bir xil so'rov satridan foydalanadi — shunda
  // fayl aynan ekranda ko'rinib turgan yozuvlarni qamrab oladi.
  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (range.from) p.set('from', range.from);
    if (range.to) p.set('to', range.to);
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [range]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get(`/expenses${queryString}`)
      .then(setExpenses)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [queryString, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const amount = toSom(form.amount);
    if (!form.description.trim()) return setFormError('Tavsifni kiriting.');
    if (!amount || amount <= 0) return setFormError("Summani to'g'ri kiriting.");
    setSaving(true);
    try {
      await api.post('/expenses', {
        expense_date: form.expense_date,
        description: form.description.trim(),
        category: form.category,
        amount,
      });
      toast.success("Harajat qo'shildi.");
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
      await api.download(`/export/expenses.xlsx${queryString}`, 'harajatlar.xlsx');
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
      await api.del(`/expenses/${deleteTarget.id}`);
      toast.success("Harajat o'chirildi.");
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
          <div className="page-title">Harajatlar</div>
          <div className="page-subtitle">
            {expenses.length} ta yozuv · Jami harajat: {money(total)}
          </div>
        </div>
        <div className="flex gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
            <IconDownload size={16} />
            {exporting ? 'Tayyorlanmoqda...' : 'Excel'}
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openCreate}>
              <IconPlus size={16} />
              Harajat qo'shish
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Yuklanmoqda...</div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <IconWallet size={28} />
            <div style={{ marginTop: 8 }}>
              {range.from || range.to ? "Tanlangan sanalarda harajat yo'q" : "Hali harajatlar yo'q"}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sana</th>
                  <th>Tavsif</th>
                  <th>Kategoriya</th>
                  <th>Summa</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td className="text-muted">{formatDate(exp.expense_date)}</td>
                    <td style={{ fontWeight: 600 }}>{exp.description}</td>
                    <td>
                      <span className="badge badge-neutral">{exp.category}</span>
                    </td>
                    <td>{money(exp.amount)}</td>
                    {isAdmin && (
                      <td>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => setDeleteTarget(exp)}
                          title="O'chirish"
                        >
                          <IconTrash size={16} />
                        </button>
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
          title="Yangi harajat qo'shish"
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
              <label>Sana</label>
              <input
                className="input"
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Tavsif</label>
              <input
                className="input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="masalan: Do'kon ijarasi"
              />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Kategoriya</label>
                <select
                  className="select"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Summa ({currency})</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step={step}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Harajatni o'chirish"
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
            <strong>{deleteTarget.description}</strong> harajatini o'chirmoqchimisiz?
          </p>
        </Modal>
      )}
    </div>
  );
}
