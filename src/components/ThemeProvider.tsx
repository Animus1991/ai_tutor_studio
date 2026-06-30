import { useEffect, ReactNode } from 'react';
import { useStore } from '../store/useStore';

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const { isDarkMode, isDyslexiaFont } = useStore();

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
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
