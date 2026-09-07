export const SUPPORTED_LOCALES = [
  "en",
  "zh-TW",
  "zh-CN",
  "ko",
  "th",
  "fr",
  "de",
  "es",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "EN",
  "zh-TW": "繁中",
  "zh-CN": "简中",
  ko: "한국어",
  th: "ไทย",
  fr: "FR",
  de: "DE",
  es: "ES",
};
