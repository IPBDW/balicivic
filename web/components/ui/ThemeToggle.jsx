'use client';

// ThemeToggle — toggle light/dark mode.
// Default: respect prefers-color-scheme. Pilihan user disimpan di localStorage.
// Pas pertama kali load, script di layout akan apply class .dark/.light ke <html>.

import { useEffect, useState } from 'react';

export function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(null); // null = loading, 'light' | 'dark'

  useEffect(() => {
    const stored = typeof window !== 'undefined' && localStorage.getItem('ds-theme');
    const initial = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    // Set initial state from localStorage / system preference after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('ds-theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    document.documentElement.classList.toggle('light', next === 'light');
  }

  if (theme === null) {
    // Skeleton loading biar gak flicker
    return <div className={`h-9 w-9 ${className}`} aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      className={[
        'inline-flex h-9 w-9 items-center justify-center rounded-full',
        'ds-surface ds-border-color border ds-text-muted hover:ds-text',
        'transition-colors',
        className,
      ].filter(Boolean).join(' ')}
    >
      {theme === 'dark' ? (
        // Sun icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}