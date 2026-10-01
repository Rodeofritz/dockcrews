export const locales = ["nl", "en", "pl", "ro", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "nl";
export const localeNames: Record<Locale, string> = {
  nl: "Nederlands",
  en: "English",
  pl: "Polski",
  ro: "Română",
  ru: "Русский",
};
export const LOCALE_COOKIE = "dockcrew_locale";
