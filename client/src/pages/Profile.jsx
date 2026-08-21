import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { IconLock } from '../components/icons/Icons';

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const emptyForm = { current_password: '', new_password: '', confirm_password: '' };

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.current_password) return setError('Joriy parolni kiriting.');
    if (form.new_password.length < 6) {
      return setError("Yangi parol kamida 6 belgidan iborat bo'lishi kerak.");
    }
    if (form.new_password !== form.confirm_password) {
      return setError('Yangi parol va tasdiq mos kelmadi.');
    }

    setSaving(true);
    try {
      await api.put('/auth/password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success('Parol yangilandi.');
      setForm(emptyForm);
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
          <div className="page-title">Profil</div>
          <div className="page-subtitle">Hisobingiz ma'lumotlari va parol</div>
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 560 }}>
        <div className="flex items-center gap-3">
          <div className="avatar" style={{ width: 52, height: 52, fontSize: 17 }}>
            {initials(user?.name)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.name}</div>
            <div className="text-muted" style={{ fontSize: 13.5 }}>
              {user?.username} ·{' '}
              <span className="badge badge-accent">
                {user?.role === 'admin' ? 'Administrator' : 'Sotuvchi'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 560 }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
          <div className="stat-icon">
            <IconLock size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Parolni o'zgartirish</div>
            <div className="text-muted" style={{ fontSize: 13 }}>
              O'zgartirilgandan so'ng boshqa qurilmalardagi sessiyalar tugatiladi
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className="error-banner">{error}</div>}

          <div className="field">
            <label htmlFor="current_password">Joriy parol</label>
            <input
              id="current_password"
              type="password"
              className="input"
              autoComplete="current-password"
              value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="new_password">Yangi parol</label>
            <input
              id="new_password"
              type="password"
              className="input"
              autoComplete="new-password"
              placeholder="Kamida 6 belgi"
              value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="confirm_password">Yangi parolni tasdiqlang</label>
            <input
              id="confirm_password"
              type="password"
              className="input"
              autoComplete="new-password"
              value={form.confirm_password}
              onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
            />
          </div>

          <div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saqlanmoqda...' : "Parolni o'zgartirish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
