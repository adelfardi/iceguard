import { useEffect } from 'react';
import { useThemeStore } from '@/hooks/useThemeStore';

/** Keeps the `dark` class on `<html>` in sync with the persisted store. */
export function ThemeInit() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return null;
}
