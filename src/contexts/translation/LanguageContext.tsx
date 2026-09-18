import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

import appJson from '../../../app.json';
import { getStoredLanguage, setStoredLanguage } from './languagePreferenceStorage';
import { detectSystemLanguage } from './systemLanguage';
import { supportedLanguageIds, type Language } from './supportedLanguages';
import PageLayoutTranslation from './PageLayoutTranslation';
import GeneralTranslation from './GeneralTranslation';
import LoginSignupTranslation from './LoginSignupTranslation';
import SettingsTranslation from './SettingsTranslation';
import ComponentTranslation from './ComponentTranslation';
import ModalTranslation from './ModalTranslation';
import LegalTranslation from './LegalTranslation';
import NotificationTranslation from './NotificationTranslation';
import VereinTranslation from './VereinTranslation';

// app.json's `expo.name`/`expo.extra` is this app's canonical identity file
// (Expo's build tooling already reads `expo.name`/`icon` for the store
// listing) -- no separate project.config.json here, see ADR-010.
const { name: appName, extra } = appJson.expo;
const defaultLanguage = extra.defaultLanguage as Language;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// Every module here covers all 11 languages except LegalTranslation, which
// stays DE/EN-only by design (ADR-009) -- LegalDocumentLayout.tsx handles
// its own English-fallback banner for the other 9 (S9), and t()'s per-key
// English fallback below covers any legal key looked up directly.
const translationModules = [
  PageLayoutTranslation,
  GeneralTranslation,
  LoginSignupTranslation,
  SettingsTranslation,
  ComponentTranslation,
  ModalTranslation,
  NotificationTranslation,
  VereinTranslation,
];

const translations = Object.fromEntries(
  supportedLanguageIds.map((lang) => [lang, Object.assign({}, ...translationModules.map((mod) => mod[lang]))]),
) as Record<Language, Record<string, string>>;

translations.de = { ...translations.de, ...LegalTranslation.de };
translations.en = { ...translations.en, ...LegalTranslation.en };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    getStoredLanguage().then((stored) => {
      if (stored) {
        setLanguageState(stored);
        return;
      }
      const systemLanguage = detectSystemLanguage();
      if (systemLanguage) setLanguageState(systemLanguage);
      // else: stays on `defaultLanguage` (initial state, now "en").
    });
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    void setStoredLanguage(lang);
  };

  // `{{paramName}}` interpolation. `appName` from app.json's `expo.name` is
  // always available this way (e.g. LegalTranslation.ts's `{{appName}}`
  // occurrences) -- an explicit `params.appName` (NotificationsScreen.tsx's
  // `useNotificationText` passes the backend's own `paramsJson` here,
  // replacing its previous separate manual `.replaceAll()` pass) overrides
  // it per call.
  const t = (key: string, params?: Record<string, string | number>): string => {
    const template = translations[language][key] || translations.en[key] || key;
    const allParams = { appName, ...params };
    return Object.entries(allParams).reduce(
      (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
      template,
    );
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
