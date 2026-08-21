import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'myhouseshop-theme';

function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

// Applied outside the React effect cycle on purpose: child effects run before
// the provider's own effect, so a consumer reading computed CSS tokens (the
// charts) would otherwise sample the previous theme's values.
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  // Initial paint only — later changes are applied by setThemeAndApply.
  useEffect(() => {
    applyTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setThemeAndApply = useCallback((next) => {
    applyTheme(next);
    setTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeAndApply(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setThemeAndApply]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: setThemeAndApply }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme ThemeProvider ichida ishlatilishi kerak');
  return ctx;
}
