import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import {
  IconHome,
  IconBox,
  IconCart,
  IconWallet,
  IconChart,
  IconUsers,
  IconSettings,
  IconSun,
  IconMoon,
  IconLogout,
  IconMenu,
  IconX,
} from './icons/Icons';

const NAV_ITEMS = [
  { to: '/', label: 'Bosh sahifa', icon: IconHome, end: true },
  { to: '/products', label: 'Mahsulotlar', icon: IconBox },
  { to: '/sales', label: 'Sotuvlar', icon: IconCart },
  { to: '/expenses', label: 'Harajatlar', icon: IconWallet },
  { to: '/analytics', label: 'Analitika', icon: IconChart },
];

const ADMIN_ITEMS = [
  { to: '/users', label: 'Foydalanuvchilar', icon: IconUsers },
  { to: '/settings', label: 'Sozlamalar', icon: IconSettings },
];

function NavList({ items, onNavigate }) {
  return (
    <nav className="flex flex-col gap-2">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => `nav-pill${isActive ? ' active' : ''}`}
        >
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { loading: settingsLoading } = useSettings();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = user?.role === 'admin' ? [...NAV_ITEMS, ...ADMIN_ITEMS] : NAV_ITEMS;

  // Nothing renders until the currency settings are known. Otherwise a page
  // would briefly assume so'm, and a price form opened in that window would
  // treat a so'm figure as dollars and multiply it by the rate on save.
  if (settingsLoading) return <div className="full-loader">Yuklanmoqda...</div>;

  return (
    <div className="app-shell">
      <aside className="sidebar sidebar-desktop">
        <div className="brand">
          <Logo size={38} />
          <div>
            <div className="brand-name">My House decor</div>
            <div className="brand-sub">Do'kon tizimi</div>
          </div>
        </div>
        <NavList items={items} />
        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme} title="Temani almashtirish">
            {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
            <span>{theme === 'dark' ? 'Yorug’ tema' : 'Qorong’u tema'}</span>
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileOpen(false)}>
          <aside className="sidebar sidebar-mobile" onClick={(e) => e.stopPropagation()}>
            <div className="brand">
              <Logo size={38} />
              <div>
                <div className="brand-name">My House decor</div>
                <div className="brand-sub">Do'kon tizimi</div>
              </div>
              <button className="btn btn-ghost btn-icon mobile-close" onClick={() => setMobileOpen(false)}>
                <IconX size={20} />
              </button>
            </div>
            <NavList items={items} onNavigate={() => setMobileOpen(false)} />
            <div className="sidebar-footer">
              <button className="theme-toggle" onClick={toggleTheme}>
                {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
                <span>{theme === 'dark' ? 'Yorug’ tema' : 'Qorong’u tema'}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="main-col">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon mobile-menu-btn" onClick={() => setMobileOpen(true)}>
            <IconMenu size={20} />
          </button>
          <NavLink to="/" className="topbar-brand">
            <Logo size={30} />
          </NavLink>
          <div className="topbar-spacer" />
          <NavLink to="/profile" className="user-chip" title="Profil">
            <div className="avatar">{initials(user?.name)}</div>
            <div className="user-meta">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role === 'admin' ? 'Administrator' : 'Sotuvchi'}</div>
            </div>
          </NavLink>
          <button className="btn btn-secondary btn-sm logout-btn" onClick={logout}>
            <IconLogout size={16} />
            <span>Chiqish</span>
          </button>
        </header>
        <main>
          <Outlet />
        </main>
        <nav className="bottom-nav">
          {items.slice(0, 5).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
