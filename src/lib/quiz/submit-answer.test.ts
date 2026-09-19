import { describe, expect, it, vi } from "vitest";
import { submitAnswerForRequest } from "@/lib/quiz/submit-answer";

const phrase = {
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

const sessionId = "11111111-1111-4111-8111-111111111111";
const phraseId = "22222222-2222-4222-8222-222222222222";

describe("submitAnswerForRequest", () => {
  it("returns 401 when the user is missing", async () => {
    const result = await submitAnswerForRequest(
      {
        sessionId,
        phraseId,
        selectedChoiceText: "Yes",
        locale: "en",
      },
      {
        getUser: vi.fn().mockResolvedValue(null),
        getSessionOwner: vi.fn(),
        isPhraseAssigned: vi.fn(),
        getPhrase: vi.fn(),
        getHearts: vi.fn(),
        consumeHeart: vi.fn(),
      },
    );

    expect(result.status).toBe(401);
  });

  it("returns 403 when the session belongs to another user", async () => {
    const result = await submitAnswerForRequest(
      {
        sessionId,
        phraseId,
        selectedChoiceText: "Yes",
        locale: "en",
      },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        getSessionOwner: vi.fn().mockResolvedValue("user-2"),
        isPhraseAssigned: vi.fn(),
        getPhrase: vi.fn(),
        getHearts: vi.fn(),
        consumeHeart: vi.fn(),
      },
    );

    expect(result.status).toBe(403);
  });

  it("returns 400 when the phrase is not assigned to the session", async () => {
    const result = await submitAnswerForRequest(
      {
        sessionId,
        phraseId,
        selectedChoiceText: "Yes",
        locale: "en",
      },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        getSessionOwner: vi.fn().mockResolvedValue("user-1"),
        isPhraseAssigned: vi.fn().mockResolvedValue(false),
        getPhrase: vi.fn(),
        getHearts: vi.fn(),
        consumeHeart: vi.fn(),
      },
    );

    expect(result.status).toBe(400);
  });

  it("grades a correct answer without consuming a heart", async () => {
    const consumeHeart = vi.fn();
    const result = await submitAnswerForRequest(
      {
        sessionId,
        phraseId,
        selectedChoiceText: "Yes",
        locale: "en",
      },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        getSessionOwner: vi.fn().mockResolvedValue("user-1"),
        isPhraseAssigned: vi.fn().mockResolvedValue(true),
        getPhrase: vi.fn().mockResolvedValue(phrase),
        getHearts: vi.fn().mockResolvedValue({
          remainingHearts: 5,
          updatedAt: "2026-09-19T00:00:00Z",
        }),
        consumeHeart,
      },
    );

    expect(consumeHeart).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 200,
      body: {
        isCorrect: true,
        remainingHearts: 5,
        updatedAt: "2026-09-19T00:00:00Z",
        correctChoiceText: "Yes",
      },
    });
  });

  it("consumes a heart only on the first incorrect grade", async () => {
    const consumeHeart = vi.fn().mockResolvedValue({
      remainingHearts: 4,
      updatedAt: "2026-09-19T00:01:00Z",
    });
    const result = await submitAnswerForRequest(
      {
        sessionId,
        phraseId,
        selectedChoiceText: "No",
        locale: "en",
      },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        getSessionOwner: vi.fn().mockResolvedValue("user-1"),
        isPhraseAssigned: vi.fn().mockResolvedValue(true),
        getPhrase: vi.fn().mockResolvedValue(phrase),
        getHearts: vi.fn(),
        consumeHeart,
      },
    );

    expect(consumeHeart).toHaveBeenCalledWith(sessionId, phraseId);
    expect(result.status).toBe(200);
    if (result.status !== 200) {
      throw new Error("expected graded answer");
    }
    expect(result.body.isCorrect).toBe(false);
    expect(result.body.remainingHearts).toBe(4);
    expect(result.body.correctChoiceText).toBe("Yes");
  });
});

describe("requestSubmitAnswer", () => {
  it("posts the selected choice to /api/quiz/submit-answer", async () => {
    const { requestSubmitAnswer } = await import(
      "@/lib/quiz/submit-answer-client"
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        isCorrect: true,
        remainingHearts: 5,
        updatedAt: "2026-09-19T00:00:00Z",
        correctChoiceText: "Yes",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestSubmitAnswer({
      sessionId,
      phraseId,
      selectedChoiceText: "Yes",
      locale: "en",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/quiz/submit-answer", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        phraseId,
        selectedChoiceText: "Yes",
        locale: "en",
      }),
    });
    expect(result.isCorrect).toBe(true);
    vi.unstubAllGlobals();
  });

  it("throws when the grading API fails", async () => {
    const { requestSubmitAnswer } = await import(
      "@/lib/quiz/submit-answer-client"
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Unable to grade answer" }),
      }),
    );

    await expect(
      requestSubmitAnswer({
        sessionId,
        phraseId,
        selectedChoiceText: "Yes",
        locale: "en",
      }),
    ).rejects.toThrow(/Unable to grade answer/);
    vi.unstubAllGlobals();
  });
});
