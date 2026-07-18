import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import enCatalog from '../locales/en.json';
import elCatalog from '../locales/el.json';

export type Language = 'en' | 'el';

const CATALOGS: Record<Language, Record<string, string>> = {
  en: enCatalog as Record<string, string>,
  el: elCatalog as Record<string, string>,
};

/** Look up a stable catalog key (EN/EL JSON). Falls back to English, then key. */
export function catalogString(lang: Language, key: string): string {
  return CATALOGS[lang]?.[key] ?? CATALOGS.en[key] ?? key;
}

/** Document text direction. EL/EN are LTR; catalogs stay RTL-ready for future locales. */
export type TextDirection = 'ltr' | 'rtl';

const STORAGE_KEY = 'memora-lang';

/** Locales that should flip layout (none of the current EL/EN pair). */
const RTL_LANGUAGES = new Set<string>(['ar', 'he', 'fa', 'ur']);

export function textDirectionForLanguage(lang: string): TextDirection {
  return RTL_LANGUAGES.has(lang.toLowerCase().slice(0, 2)) ? 'rtl' : 'ltr';
}

export interface LanguageContextValue {
  language: Language;
  dir: TextDirection;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  /**
   * Translate helper. Pass the English string and (optionally) the Greek
   * string. Returns the string for the active language, falling back to
   * English when a Greek translation is not supplied.
   */
  t: (en: string, el?: string) => string;
  /** Catalog-key lookup against src/locales/{en,el}.json */
  tc: (key: string) => string;
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

  const tc = useCallback((key: string) => catalogString(language, key), [language]);

  const dir = textDirectionForLanguage(language);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
    document.documentElement.dataset.textDirection = dir;
  }, [language, dir]);

  return (
    <LanguageContext.Provider value={{ language, dir, setLanguage, toggleLanguage, t, tc }}>
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
    dir: 'ltr',
    setLanguage: () => {},
    toggleLanguage: () => {},
    t: (en: string) => en,
    tc: (key: string) => catalogString('en', key),
  };
}

export default LanguageProvider;
