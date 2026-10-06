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
  it("uses English choices when locale is ja and returns the correct text", () => {
    const result = prepareQuestion(validPhrase, "ja", keepOrder);

    expect(result.choices).toEqual([...validPhrase.choices_by_lang.en]);
    expect(result.choices.every((choice) => typeof choice === "string")).toBe(
      true,
    );
    expect(result.phrase).toEqual({
      id: validPhrase.id,
      pack_id: validPhrase.pack_id,
      romaji: validPhrase.romaji,
      japanese: validPhrase.japanese,
      audio_url: validPhrase.audio_url,
    });
    expect(result).not.toHaveProperty("prompt");
    expect(result.phrase).not.toHaveProperty("translations");
    expect(result.phrase).not.toHaveProperty("choices_by_lang");
    expect(result.phrase).not.toHaveProperty("correct_choice_index");
    expect(result.correctChoiceText).toBe("Thank you");
    expect(result).not.toHaveProperty("correctChoiceIndex");
  });

  it("uses English choices when locale is en", () => {
    const result = prepareQuestion(validPhrase, "en", keepOrder);

    expect(result.choices).toEqual(["Thank you", "Sorry", "Hello"]);
    expect(result.correctChoiceText).toBe("Thank you");
  });

  it("keeps the correct text after the choices are shuffled", () => {
    const result = prepareQuestion(validPhrase, "en", () => 0);

    expect(result.choices).toContain("Thank you");
    expect(result.correctChoiceText).toBe("Thank you");
    expect(result.choices).not.toEqual(["Thank you", "Sorry", "Hello"]);
  });
});
