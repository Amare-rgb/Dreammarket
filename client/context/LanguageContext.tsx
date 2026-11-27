'use client';
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';
import en from '@/locales/en.json';
import am from '@/locales/am.json';
export type Language = 'en' | 'am';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}
const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});
const STORAGE_KEY = 'site_lang';
const subscribe = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('storage', callback);
  window.addEventListener('language-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('language-change', callback);
  };
};
const getClientSnapshot = (): Language => {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'am' ? 'am' : 'en';
  } catch {
    return 'en';
  }
};
const getServerSnapshot = (): Language => 'en';
type Dict = { [key: string]: string | Dict };
function resolveKey(dict: unknown, keys: string[]): string | null {
  let current: unknown = dict;
  for (const k of keys) {
    if (
      current &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      k in (current as Record<string, unknown>)
    ) {
      current = (current as Record<string, unknown>)[k];
    } else {
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
}
const translations: Record<Language, Dict> = {
  en: en as unknown as Dict,
  am: am as unknown as Dict,
};
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const storedLanguage = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  const [overrideLanguage, setOverrideLanguage] = useState<Language | null>(
    null
  );
  const language: Language = overrideLanguage ?? storedLanguage;
  const setLanguage = useCallback((lang: Language) => {
    setOverrideLanguage(lang);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang);
        window.dispatchEvent(
          new CustomEvent('language-change', { detail: lang })
        );
      }
    } catch {
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    const next: Language = language === 'en' ? 'am' : 'en';
    setLanguage(next);
  }, [language, setLanguage]);
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const keys = key.split('.');
      const activeValue = resolveKey(translations[language], keys);
      if (activeValue !== null) return activeValue;
      const englishValue = resolveKey(translations.en, keys);
      if (englishValue !== null) return englishValue;
      return fallback || key;
    },
    [language]
  );
  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, setLanguage, toggleLanguage, t]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}