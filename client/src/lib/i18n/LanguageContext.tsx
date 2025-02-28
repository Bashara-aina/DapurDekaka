
import { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations } from './translations';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getBrowserLanguage(): Language {
  const browserLang = navigator.language.split('-')[0];
  return browserLang === 'id' ? 'id' : 'en';
}

// Cache translation results to avoid repeated lookups
const translationCache = new Map<string, string>();

function getInitialLanguage(): Language {
  try {
    const savedLanguage = localStorage.getItem('language') as Language;
    return savedLanguage || getBrowserLanguage();
  } catch (e) {
    // Handle case where localStorage is not available
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  // Clear cache when language changes
  useEffect(() => {
    translationCache.clear();
  }, [language]);

  const setLanguage = useCallback((newLanguage: Language) => {
    setLanguageState(newLanguage);
    try {
      localStorage.setItem('language', newLanguage);
    } catch (e) {
      console.warn('Failed to save language to localStorage');
    }
  }, []);

  const t = useCallback((path: string) => {
    // Check cache first
    const cacheKey = `${language}:${path}`;
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey) as string;
    }

    const keys = path.split('.');
    let current: any = translations[language];
    
    for (const key of keys) {
      if (current[key] === undefined) {
        // Cache missing translations too to avoid repeated warnings
        translationCache.set(cacheKey, path);
        return path;
      }
      current = current[key];
    }
    
    // Cache the result for future use
    translationCache.set(cacheKey, current);
    return current;
  }, [language]);

  // Set initial language only once on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (!savedLanguage) {
      setLanguage(getBrowserLanguage());
    }
  }, []);

  // Memoize context value to prevent unnecessary rerenders
  const contextValue = useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
