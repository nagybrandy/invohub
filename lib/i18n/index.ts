// lib/i18n/index.ts
// i18n setup with English as the default language.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/lib/i18n/locales/en";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
