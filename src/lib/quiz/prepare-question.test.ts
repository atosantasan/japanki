import { describe, expect, it } from "vitest";
import { prepareQuestion } from "@/lib/quiz/prepare-question";
import type { PhraseRecord } from "@/lib/validation/translation-schema";

const validPhrase: PhraseRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  pack_id: "survival",
  romaji: "arigatou",
  japanese: "ありがとう",
  audio_url: "/audio/arigatou.mp3",
  translations: {
    en: "Thank you",
    "zh-TW": "謝謝",
    "zh-CN": "谢谢",
    ko: "감사합니다",
    th: "ขอบคุณ",
    fr: "Merci",
    de: "Danke",
    es: "Gracias",
  },
  choices_by_lang: {
    en: ["Thank you", "Sorry", "Hello"],
    "zh-TW": ["謝謝", "對不起", "你好"],
    "zh-CN": ["谢谢", "对不起", "你好"],
    ko: ["감사합니다", "미안합니다", "안녕하세요"],
    th: ["ขอบคุณ", "ขอโทษ", "สวัสดี"],
    fr: ["Merci", "Désolé", "Bonjour"],
    de: ["Danke", "Entschuldigung", "Hallo"],
    es: ["Gracias", "Lo siento", "Hola"],
  },
  correct_choice_index: 0,
};

const keepOrder = () => 0.99;

describe("prepareQuestion", () => {
  it("uses English choices and prompt when locale is ja", () => {
    const result = prepareQuestion(validPhrase, "ja", keepOrder);

    expect(result.prompt).toBe(validPhrase.translations.en);
    expect(result.choices).toEqual([...validPhrase.choices_by_lang.en]);
    expect(result.choices.every((choice) => typeof choice === "string")).toBe(
      true,
    );
    expect(result.choices[result.correctIndex]).toBe("Thank you");
  });

  it("uses English choices and prompt when locale is en", () => {
    const result = prepareQuestion(validPhrase, "en", keepOrder);

    expect(result.prompt).toBe("Thank you");
    expect(result.choices).toEqual(["Thank you", "Sorry", "Hello"]);
    expect(result.correctIndex).toBe(0);
  });
});
