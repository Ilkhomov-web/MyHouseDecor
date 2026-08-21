import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import { IconPlus, IconTrash, IconLock } from '../components/icons/Icons';
import { formatDate } from '../utils/format';

const emptyForm = { name: '', username: '', password: '', role: 'sotuvchi' };

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/users')
      .then(setUsers)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim() || !form.username.trim()) return setFormError('Ism va loginni kiriting.');
    if (form.password.length < 6) return setFormError('Parol kamida 6 belgidan iborat bo\'lishi kerak.');
    setSaving(true);
    try {
      await api.post('/users', {
        name: form.name.trim(),
        username: form.username.trim(),
        password: form.password,
        role: form.role,
      });
      toast.success("Foydalanuvchi qo'shildi.");
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}/toggle-active`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openReset = (u) => {
    setResetTarget(u);
    setResetPassword('');
    setResetError('');
  };

  const handleReset = async () => {
    setResetError('');
    if (resetPassword.length < 6) {
      return setResetError("Parol kamida 6 belgidan iborat bo'lishi kerak.");
    }
    setResetting(true);
    try {
      await api.put(`/users/${resetTarget.id}/password`, { new_password: resetPassword });
      toast.success(`${resetTarget.name} uchun parol yangilandi.`);
      setResetTarget(null);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/users/${deleteTarget.id}`);
      toast.success("Foydalanuvchi o'chirildi.");
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
          <div className="page-title">Foydalanuvchilar</div>
          <div className="page-subtitle">Admin va sotuvchilar hisoblarini boshqarish</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <IconPlus size={16} />
          Foydalanuvchi qo'shish
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">Yuklanmoqda...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ism</th>
                  <th>Login</th>
                  <th>Rol</th>
                  <th>Holat</th>
                  <th>Qo'shilgan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>
                      {u.name} {u.id === me.id && <span className="text-muted">(siz)</span>}
                    </td>
                    <td className="text-muted">{u.username}</td>
                    <td>
                      <span className="badge badge-accent">{u.role === 'admin' ? 'Administrator' : 'Sotuvchi'}</span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-positive' : 'badge-negative'}`}>
                        {u.is_active ? 'Faol' : 'Faol emas'}
                      </span>
                    </td>
                    <td className="text-muted">{formatDate(u.created_at)}</td>
                    <td>
                      {u.id !== me.id && (
                        <div className="flex gap-2">
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => openReset(u)}
                            title="Parolni tiklash"
                          >
                            <IconLock size={16} />
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(u)}>
                            {u.is_active ? 'Faolsizlantirish' : 'Faollashtirish'}
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => setDeleteTarget(u)}
                            title="O'chirish"
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal
          title="Yangi foydalanuvchi qo'shish"
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
              <label>To'liq ism</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Login</label>
              <input
                className="input"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Parol</label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Rol</label>
              <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="sotuvchi">Sotuvchi</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal
          title="Parolni tiklash"
          onClose={() => setResetTarget(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setResetTarget(null)}>
                Bekor qilish
              </button>
              <button className="btn btn-primary" onClick={handleReset} disabled={resetting}>
                {resetting ? 'Saqlanmoqda...' : 'Tiklash'}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            {resetError && <div className="error-banner">{resetError}</div>}
            <p className="text-muted" style={{ fontSize: 14 }}>
              <strong style={{ color: 'var(--text)' }}>{resetTarget.name}</strong> uchun yangi parol
              belgilanadi. Uning barcha ochiq sessiyalari darhol tugatiladi.
            </p>
            <div className="field">
              <label>Yangi parol</label>
              <input
                className="input"
                type="text"
                autoComplete="off"
                placeholder="Kamida 6 belgi"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
              <span className="text-muted" style={{ fontSize: 12.5 }}>
                Parolni xodimga yetkazing — u keyin Profil sahifasidan o'zgartirishi mumkin.
              </span>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Foydalanuvchini o'chirish"
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
            <strong>{deleteTarget.name}</strong> foydalanuvchisini o'chirmoqchimisiz?
          </p>
        </Modal>
      )}
    </div>
  );
}
