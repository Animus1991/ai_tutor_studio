import { useEffect, ReactNode } from 'react';
import { useStore } from '../store/useStore';

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const { isDarkMode, toggleDarkMode, isDyslexiaFont } = useStore();

  // On mount, check localStorage
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' && !isDarkMode) {
      toggleDarkMode(); // Sync store with localStorage
    } else if (storedTheme === 'light' && isDarkMode) {
      toggleDarkMode();
    }
  }, []); // Only run once on mount

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (isDyslexiaFont) {
      document.body.classList.add('font-dyslexic');
    } else {
      document.body.classList.remove('font-dyslexic');
    }
  }, [isDyslexiaFont]);

  return <>{children}</>;
}
