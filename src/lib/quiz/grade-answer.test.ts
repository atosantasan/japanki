import { describe, expect, it } from "vitest";
import { gradeSelectedChoice } from "@/lib/quiz/grade-answer";

const choicesByLang = {
  en: ["Thank you", "Sorry", "Hello"],
  "zh-TW": ["謝謝", "對不起", "你好"],
  "zh-CN": ["谢谢", "对不起", "你好"],
  ko: ["감사합니다", "미안합니다", "안녕하세요"],
  th: ["ขอบคุณ", "ขอโทษ", "สวัสดี"],
  fr: ["Merci", "Désolé", "Bonjour"],
  de: ["Danke", "Entschuldigung", "Hallo"],
  es: ["Gracias", "Lo siento", "Hola"],
} as {
  en: [string, string, string];
  "zh-TW": [string, string, string];
  "zh-CN": [string, string, string];
  ko: [string, string, string];
  th: [string, string, string];
  fr: [string, string, string];
  de: [string, string, string];
  es: [string, string, string];
};

describe("gradeSelectedChoice", () => {
  it("marks the stored correct text as correct without using a client index", () => {
    const result = gradeSelectedChoice({
      selectedChoiceText: "Sorry",
      choicesByLang,
      correctChoiceIndex: 1,
      locale: "en",
    });

    expect(result.isCorrect).toBe(true);
    expect(result.correctChoiceText).toBe("Sorry");
  });

  it("marks a distractor as incorrect and still returns the correct text", () => {
    const result = gradeSelectedChoice({
      selectedChoiceText: "Hello",
      choicesByLang,
      correctChoiceIndex: 0,
      locale: "en",
    });

    expect(result.isCorrect).toBe(false);
    expect(result.correctChoiceText).toBe("Thank you");
  });

  it("uses English choices when the UI locale is ja", () => {
    const result = gradeSelectedChoice({
      selectedChoiceText: "Thank you",
      choicesByLang,
      correctChoiceIndex: 0,
      locale: "ja",
    });

    expect(result.isCorrect).toBe(true);
    expect(result.correctChoiceText).toBe("Thank you");
  });
});
