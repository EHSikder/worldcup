'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { en } from '@/locales/en';
import { ar } from '@/locales/ar';

const LanguageContext = createContext();

const dictionaries = { en, ar };

export const LanguageProvider = ({ children }) => {
  const [locale, setLocale] = useState('ar');

  useEffect(() => {
    // Load from local storage on mount
    const saved = localStorage.getItem('wc2026_locale');
    if (saved && ['en', 'ar'].includes(saved)) {
      setLocale(saved);
    }
  }, []);

  useEffect(() => {
    // Update HTML dir and lang attributes
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    localStorage.setItem('wc2026_locale', locale);
  }, [locale]);

  const toggleLanguage = () => {
    setLocale((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };

  const t = (key) => {
    return dictionaries[locale][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
