import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

// English only for now; resources are bundled so translations are ready on the server and in the browser.
i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18n;
