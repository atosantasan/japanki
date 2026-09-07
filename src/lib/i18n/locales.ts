export const CONTENT_LOCALES = [
  "en",
  "zh-TW",
  "zh-CN",
  "ko",
  "th",
  "fr",
  "de",
  "es",
] as const;

export const SUPPORTED_LOCALES = [...CONTENT_LOCALES, "ja"] as const;

export type ContentLocale = (typeof CONTENT_LOCALES)[number];
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
  ja: "日本語 (ja)",
};

export function toContentLocale(locale: SupportedLocale): ContentLocale {
  if ((CONTENT_LOCALES as readonly string[]).includes(locale)) {
    return locale as ContentLocale;
  }
  return "en";
}
