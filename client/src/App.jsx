import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { SettingsProvider } from './context/SettingsContext';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Expenses from './pages/Expenses';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

// Recharts is heavy — only pull it into the bundle when Analitika is visited.
const Analytics = lazy(() => import('./pages/Analytics'));

function PageLoader() {
  return <div className="page"><div className="empty-state">Yuklanmoqda...</div></div>;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <SettingsProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/sales" element={<Sales />} />
                    <Route path="/expenses" element={<Expenses />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route
                      path="/analytics"
                      element={
                        <Suspense fallback={<PageLoader />}>
                          <Analytics />
                        </Suspense>
                      }
                    />
                    <Route element={<AdminRoute />}>
                      <Route path="/users" element={<Users />} />
                      <Route path="/settings" element={<Settings />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Route>
              </Routes>
            </SettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
