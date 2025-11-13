import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import no from './locales/no.json';
import sv from './locales/sv.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import da from './locales/da.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import it from './locales/it.json';

const resources = {
  en: { translation: en },
  no: { translation: no },
  sv: { translation: sv },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  da: { translation: da },
  ja: { translation: ja },
  zh: { translation: zh },
  it: { translation: it }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
