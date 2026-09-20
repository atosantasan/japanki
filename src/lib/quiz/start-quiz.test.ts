import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { startQuizForRequest } from "@/lib/quiz/start-quiz";

const phraseBase = {
  pack_id: "survival",
  romaji: "hai",
  japanese: "はい",
  audio_url: "/audio/hai.mp3",
  translations: {
    en: "Yes",
    "zh-TW": "是",
    "zh-CN": "是",
    ko: "네",
    th: "ครับ/ค่ะ",
    fr: "Oui",
    de: "Ja",
    es: "Sí",
  },
  choices_by_lang: {
    en: ["Yes", "No", "Maybe"],
    "zh-TW": ["是", "不是", "也許"],
    "zh-CN": ["是", "不是", "也许"],
    ko: ["네", "아니요", "아마도"],
    th: ["ครับ/ค่ะ", "ไม่", "อาจจะ"],
    fr: ["Oui", "Non", "Peut-être"],
    de: ["Ja", "Nein", "Vielleicht"],
    es: ["Sí", "No", "Quizá"],
  },
  correct_choice_index: 0,
} as const;

const phraseIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
] as const;

const phrases = phraseIds.map((id) => ({ ...phraseBase, id }));
const assigned = phraseIds.map((phrase_id, index) => ({
  phrase_id,
  position: index + 1,
}));

describe("startQuizForRequest", () => {
  it("returns 401 when the user is missing", async () => {
    const createSession = vi.fn();
    const result = await startQuizForRequest(
      { packId: "survival", locale: "en" },
      {
        getUser: vi.fn().mockResolvedValue(null),
        createSession,
        loadAssigned: vi.fn(),
        loadPhrases: vi.fn(),
        getHearts: vi.fn(),
      },
    );

    expect(result.status).toBe(401);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("returns 403 when create_quiz_session rejects an unpaid pack", async () => {
    const result = await startQuizForRequest(
      { packId: "travel", locale: "en" },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        createSession: vi
          .fn()
          .mockRejectedValue(new Error("Purchased pack permission required")),
        loadAssigned: vi.fn(),
        loadPhrases: vi.fn(),
        getHearts: vi.fn(),
      },
    );

    expect(result.status).toBe(403);
  });

  it("returns 404 when create_quiz_session does not find an active pack", async () => {
    const result = await startQuizForRequest(
      { packId: "retired", locale: "en" },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        createSession: vi
          .fn()
          .mockRejectedValue(new Error("Content pack not found")),
        loadAssigned: vi.fn(),
        loadPhrases: vi.fn(),
        getHearts: vi.fn(),
      },
    );

    expect(result.status).toBe(404);
    expect(result.body).toEqual({ error: "Content pack not found" });
  });

  it("returns 429 when create_quiz_session is rate limited", async () => {
    const loadAssigned = vi.fn();
    const result = await startQuizForRequest(
      { packId: "survival", locale: "en" },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        createSession: vi
          .fn()
          .mockRejectedValue(new Error("Rate limit exceeded")),
        loadAssigned,
        loadPhrases: vi.fn(),
        getHearts: vi.fn(),
      },
    );

    expect(result.status).toBe(429);
    expect(result.body).toEqual({ error: "Rate limit exceeded" });
    expect(loadAssigned).not.toHaveBeenCalled();
  });

  it("returns five prepared questions without correct_choice_index", async () => {
    const loadAssigned = vi.fn().mockResolvedValue(assigned);
    const loadPhrases = vi.fn().mockResolvedValue(phrases);
    const getHearts = vi.fn().mockResolvedValue({
      remainingHearts: 5,
      updatedAt: "2026-09-19T00:00:00Z",
    });

    const result = await startQuizForRequest(
      { packId: "survival", locale: "en" },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        createSession: vi.fn().mockResolvedValue("sess-1"),
        loadAssigned,
        loadPhrases,
        getHearts,
      },
    );

    expect(loadAssigned).toHaveBeenCalledWith("sess-1");
    expect(result.status).toBe(200);
    if (result.status !== 200) {
      throw new Error("expected started quiz");
    }
    expect(result.body.sessionId).toBe("sess-1");
    expect(result.body.questions).toHaveLength(5);
    expect(result.body.questions[0]?.choices).toHaveLength(3);
    expect(result.body.questions[0]).not.toHaveProperty("correctChoiceText");
    expect(result.body.questions[0]).not.toHaveProperty("prompt");
    expect(result.body.questions[0]?.phrase).not.toHaveProperty(
      "correct_choice_index",
    );
    expect(result.body.questions[0]?.phrase).not.toHaveProperty("translations");
    expect(result.body.questions[0]?.phrase).not.toHaveProperty(
      "choices_by_lang",
    );
    expect(JSON.stringify(result.body)).not.toContain("correct_choice_index");
    expect(JSON.stringify(result.body)).not.toContain("correctChoiceText");
    expect(JSON.stringify(result.body)).not.toContain("correctChoiceIndex");
  });
});

describe("quiz start API", () => {
  it("loads assignment, phrases, and hearts in one Promise.all after session create", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "start-quiz.ts"),
      "utf8",
    );
    expect(source).toMatch(/Promise\.all\(/);
    expect(source).toMatch(/createSession/);
    expect(source).not.toMatch(/gradeSelectedChoice/);
    expect(source).not.toMatch(/correctChoiceText/);
  });
});
