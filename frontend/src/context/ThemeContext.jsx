import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';

export const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
});

const THEME_STORAGE_KEY = 'moneyflow_theme';

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch (e) {
      console.warn('Unable to access localStorage for theme:', e);
    }
    return 'system';
  });

  const getSystemTheme = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    if (theme === 'system') {
      return getSystemTheme();
    }
    return theme;
  });

  // Apply theme class to document root
  const applyTheme = useCallback((activeTheme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (activeTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      root.setAttribute('data-theme', 'light');
    }
  }, []);

  // Update theme preference
  const setTheme = useCallback((newTheme) => {
    if (newTheme !== 'light' && newTheme !== 'dark' && newTheme !== 'system') return;
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      console.warn('Unable to save theme to localStorage:', e);
    }

    const calculated = newTheme === 'system' ? getSystemTheme() : newTheme;
    setResolvedTheme(calculated);
    applyTheme(calculated);
  }, [getSystemTheme, applyTheme]);

  // Initial and reactive effect
  useEffect(() => {
    const active = theme === 'system' ? getSystemTheme() : theme;
    setResolvedTheme(active);
    applyTheme(active);

    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e) => {
      if (theme === 'system') {
        const isDark = typeof e?.matches === 'boolean' ? e.matches : mediaQuery.matches;
        const nextTheme = isDark ? 'dark' : 'light';
        setResolvedTheme(nextTheme);
        applyTheme(nextTheme);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleSystemChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleSystemChange);
      }
    };
  }, [theme, getSystemTheme, applyTheme]);

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    setTheme,
  }), [theme, resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
