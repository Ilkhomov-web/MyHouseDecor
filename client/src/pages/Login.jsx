import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IconLock } from '../components/icons/Icons';
import Logo from '../components/Logo';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    const from = location.state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Login va parolni kiriting.');
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Kirishda xatolik yuz berdi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo size={52} />
          <div>
            <div className="brand-name">My House decor</div>
            <div className="brand-sub">Do'kon boshqaruv tizimi</div>
          </div>
        </div>

        <div className="auth-heading">
          <h1>Tizimga kirish</h1>
          <p className="text-muted">Davom etish uchun login va parolingizni kiriting</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className="error-banner">{error}</div>}
          <div className="field">
            <label htmlFor="username">Login</label>
            <input
              id="username"
              className="input"
              autoComplete="username"
              placeholder="masalan: admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">Parol</label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
            <IconLock size={16} />
            {submitting ? 'Tekshirilmoqda...' : 'Kirish'}
          </button>
        </form>

        {/* Development only — a production build must never advertise credentials. */}
        {import.meta.env.DEV && (
          <div className="auth-hint">
            <span className="badge badge-accent">Demo</span>
            <span>admin / admin123 &nbsp;yoki&nbsp; sardor / sardor123</span>
          </div>
        )}
      </div>
    </div>
  );
}
