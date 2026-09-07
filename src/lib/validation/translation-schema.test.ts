import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import {
  AppMessagesSchema,
  ChoicesByLangSchema,
  PhraseContentSchema,
  TranslationSchema,
} from "@/lib/validation/translation-schema";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const completeTranslations = {
  en: "Thank you",
  "zh-TW": "謝謝",
  "zh-CN": "谢谢",
  ko: "감사합니다",
  th: "ขอบคุณ",
  fr: "Merci",
  de: "Danke",
  es: "Gracias",
};

const completeChoices = {
  en: ["Thank you", "Sorry", "Hello"],
  "zh-TW": ["謝謝", "對不起", "你好"],
  "zh-CN": ["谢谢", "对不起", "你好"],
  ko: ["감사합니다", "미안합니다", "안녕하세요"],
  th: ["ขอบคุณ", "ขอโทษ", "สวัสดี"],
  fr: ["Merci", "Désolé", "Bonjour"],
  de: ["Danke", "Entschuldigung", "Hallo"],
  es: ["Gracias", "Lo siento", "Hola"],
} as const;

describe("TranslationSchema", () => {
  it("accepts dictionaries that include all 8 locales", () => {
    const parsed = TranslationSchema.parse(completeTranslations);
    expect(Object.keys(parsed)).toEqual([...SUPPORTED_LOCALES]);
  });

  it("rejects dictionaries that are missing a locale key", () => {
    const missingSpanish = Object.fromEntries(
      Object.entries(completeTranslations).filter(([key]) => key !== "es"),
    );
    const result = TranslationSchema.safeParse(missingSpanish);
    expect(result.success).toBe(false);
  });
});

describe("ChoicesByLangSchema", () => {
  it("requires exactly 3 choices for every locale", () => {
    expect(ChoicesByLangSchema.parse(completeChoices).en).toHaveLength(3);
  });

  it("rejects a locale with fewer than 3 choices", () => {
    const result = ChoicesByLangSchema.safeParse({
      ...completeChoices,
      en: ["Thank you", "Sorry"],
    });
    expect(result.success).toBe(false);
  });
});

describe("PhraseContentSchema", () => {
  it("validates a phrase payload with 8-language translations and choices", () => {
    const parsed = PhraseContentSchema.parse({
      romaji: "arigatou",
      japanese: "ありがとう",
      audio_url: "https://cdn.example.com/arigatou.mp3",
      translations: completeTranslations,
      choices_by_lang: completeChoices,
      correct_choice_index: 0,
    });

    expect(parsed.correct_choice_index).toBe(0);
    expect(parsed.translations.en).toBe("Thank you");
  });
});

describe("AppMessagesSchema", () => {
  it("validates all 8 locale message files including legal copy", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const filePath = join(rootDir, "messages", `${locale}.json`);
      const messages = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
      const parsed = AppMessagesSchema.parse(messages);
      expect(parsed.HomePage.title).toBe("Japanki");
      expect(parsed.Legal.terms.title.length).toBeGreaterThan(0);
      expect(parsed.Legal.privacy.collect.body.length).toBeGreaterThan(0);
      expect(parsed.Legal.tokusho.valueEmail).toContain("japankiadm@gmail.com");
      expect(parsed.Account.manageBilling.length).toBeGreaterThan(0);
      expect(parsed.Quiz.audioFallback.length).toBeGreaterThan(0);
    }
  });

  it("rejects a dictionary that is missing legal terms body copy", () => {
    const filePath = join(rootDir, "messages", "en.json");
    const messages = JSON.parse(readFileSync(filePath, "utf8")) as {
      Legal?: { terms?: { apply?: { body?: string } } };
    };
    if (messages.Legal?.terms?.apply) {
      messages.Legal.terms.apply.body = "";
    }
    const result = AppMessagesSchema.safeParse(messages);
    expect(result.success).toBe(false);
  });
});
