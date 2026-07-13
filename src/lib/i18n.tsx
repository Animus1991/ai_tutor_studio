import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

export type Language = 'en' | 'el';

const STORAGE_KEY = 'memora-lang';

export interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  /**
   * Translate helper. Pass the English string and (optionally) the Greek
   * string. Returns the string for the active language, falling back to
   * English when a Greek translation is not supplied.
   */
  t: (en: string, el?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function readInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'el') return stored;
    // Fall back to the browser preference for Greek speakers.
    if (navigator.language?.toLowerCase().startsWith('el')) return 'el';
  } catch {
    /* ignore */
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'el' : 'en');
  }, [language, setLanguage]);

  const t = useCallback(
    (en: string, el?: string) => (language === 'el' && el ? el : en),
    [language],
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Access the active language and translation helper.
 * Returns a safe English-only fallback when used outside a provider (e.g.
 * during HMR or early render) instead of throwing.
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  return {
    language: 'en',
    setLanguage: () => {},
    toggleLanguage: () => {},
    t: (en: string) => en,
  };
}

export default LanguageProvider;
