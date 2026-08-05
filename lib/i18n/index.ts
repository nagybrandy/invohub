// lib/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/lib/i18n/locales/en";
import hu from "@/lib/i18n/locales/hu";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hu: { translation: hu },
  },
  lng: "hu",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
