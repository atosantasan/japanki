import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
const hearts = {
  remainingHearts: 5,
  updatedAt: "2026-09-19T00:00:00Z",
};

function ownedContext(overrides?: {
  ownerId?: string | null;
  assigned?: boolean;
  phrase?: typeof phrase | null;
  hearts?: typeof hearts;
}) {
  return {
    ownerId: overrides?.ownerId === undefined ? "user-1" : overrides.ownerId,
    assigned: overrides?.assigned ?? true,
    phrase: overrides && "phrase" in overrides ? overrides.phrase : phrase,
    hearts: overrides?.hearts ?? hearts,
  };
}

describe("submitAnswerForRequest", () => {
  it("returns 401 when the user is missing", async () => {
    const loadGradeContext = vi.fn();
    const submitAnswer = vi.fn();
    const result = await submitAnswerForRequest(
      {
        sessionId,
        phraseId,
        selectedChoiceText: "Yes",
        locale: "en",
      },
      {
        getUser: vi.fn().mockResolvedValue(null),
        loadGradeContext,
        submitAnswer,
      },
    );

    expect(result.status).toBe(401);
    expect(loadGradeContext).not.toHaveBeenCalled();
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
        loadGradeContext: vi.fn().mockResolvedValue(ownedContext({ ownerId: "user-2" })),
        submitAnswer: vi.fn(),
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
        loadGradeContext: vi.fn().mockResolvedValue(ownedContext({ assigned: false })),
        submitAnswer: vi.fn(),
      },
    );

    expect(result.status).toBe(400);
  });

  it("returns the submit_answer RPC result for a correct grade", async () => {
    const submitAnswer = vi.fn().mockResolvedValue({
      isCorrect: true,
      remainingHearts: 5,
      updatedAt: "2026-09-19T00:00:00Z",
      correctChoiceText: "Yes",
    });
    const loadGradeContext = vi.fn().mockResolvedValue(ownedContext());
    const result = await submitAnswerForRequest(
      {
        sessionId,
        phraseId,
        selectedChoiceText: "Yes",
        locale: "en",
      },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        loadGradeContext,
        submitAnswer,
      },
    );

    expect(loadGradeContext).toHaveBeenCalledWith(sessionId, phraseId, "user-1");
    expect(submitAnswer).toHaveBeenCalledWith(sessionId, phraseId, "Yes", "en");
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

  it("returns the submit_answer RPC result for an incorrect grade", async () => {
    const submitAnswer = vi.fn().mockResolvedValue({
      isCorrect: false,
      remainingHearts: 4,
      updatedAt: "2026-09-19T00:01:00Z",
      correctChoiceText: "Yes",
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
        loadGradeContext: vi.fn().mockResolvedValue(ownedContext()),
        submitAnswer,
      },
    );

    expect(submitAnswer).toHaveBeenCalledWith(sessionId, phraseId, "No", "en");
    expect(result.status).toBe(200);
    if (result.status !== 200) {
      throw new Error("expected graded answer");
    }
    expect(result.body.isCorrect).toBe(false);
    expect(result.body.remainingHearts).toBe(4);
    expect(result.body.correctChoiceText).toBe("Yes");
  });

  it("rejects grading when remaining hearts are 0", async () => {
    const submitAnswer = vi.fn();
    const result = await submitAnswerForRequest(
      {
        sessionId,
        phraseId,
        selectedChoiceText: "Yes",
        locale: "en",
      },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        loadGradeContext: vi.fn().mockResolvedValue(
          ownedContext({
            hearts: { remainingHearts: 0, updatedAt: "2026-09-19T00:00:00Z" },
          }),
        ),
        submitAnswer,
      },
    );

    expect(result.status).toBe(403);
    expect(submitAnswer).not.toHaveBeenCalled();
  });

  it("returns 409 invalid_choice when submit_answer rejects an unknown choice", async () => {
    const result = await submitAnswerForRequest(
      {
        sessionId,
        phraseId,
        selectedChoiceText: "not-a-real-choice",
        locale: "en",
      },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        loadGradeContext: vi.fn().mockResolvedValue(ownedContext()),
        submitAnswer: vi
          .fn()
          .mockRejectedValue(new Error("Invalid choice")),
      },
    );

    expect(result.status).toBe(409);
    expect(result.body).toEqual({ error: "invalid_choice" });
  });

  it("returns 429 when submit_answer reports Rate limit exceeded", async () => {
    const submitAnswer = vi
      .fn()
      .mockRejectedValue(new Error("Rate limit exceeded"));
    const result = await submitAnswerForRequest(
      {
        sessionId,
        phraseId,
        selectedChoiceText: "Yes",
        locale: "en",
      },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        loadGradeContext: vi.fn().mockResolvedValue(ownedContext()),
        submitAnswer,
      },
    );

    expect(result.status).toBe(429);
    expect(result.body).toEqual({ error: "Rate limit exceeded" });
    expect(submitAnswer).toHaveBeenCalled();
  });

  it("grades normally when submit_answer succeeds inside the hourly limit", async () => {
    const result = await submitAnswerForRequest(
      {
        sessionId,
        phraseId,
        selectedChoiceText: "Yes",
        locale: "en",
      },
      {
        getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
        loadGradeContext: vi.fn().mockResolvedValue(ownedContext()),
        submitAnswer: vi.fn().mockResolvedValue({
          isCorrect: true,
          remainingHearts: 5,
          updatedAt: "2026-09-19T00:00:00Z",
          correctChoiceText: "Yes",
        }),
      },
    );

    expect(result.status).toBe(200);
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
      cache: "no-store",
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

  it("surfaces invalid_choice from a 409 grading response", async () => {
    const { requestSubmitAnswer } = await import(
      "@/lib/quiz/submit-answer-client"
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "invalid_choice" }),
      }),
    );

    await expect(
      requestSubmitAnswer({
        sessionId,
        phraseId,
        selectedChoiceText: "stale-text",
        locale: "en",
      }),
    ).rejects.toThrow(/^invalid_choice$/);
    vi.unstubAllGlobals();
  });
});

describe("submit-answer latency", () => {
  const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

  it("loads session, assignment, phrase, and hearts in one Promise.all", () => {
    const source = readFileSync(
      join(srcDir, "app/api/quiz/submit-answer/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/Promise\.all\(/);
    expect(source).toMatch(/export async function GET/);
    expect(source).not.toMatch(/getSessionOwner/);
    expect(source).not.toMatch(/isPhraseAssigned/);
  });

  it("does not use an in-memory submit-answer rate limiter", () => {
    const source = readFileSync(
      join(srcDir, "lib/quiz/submit-answer.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/consumeRateLimit/);
    expect(source).toMatch(/RATE_LIMIT_EXCEEDED_ERROR/);
    expect(source).toMatch(/loader\.submitAnswer/);
  });

  it("warms quiz APIs from the shared layout helper", () => {
    const source = readFileSync(
      join(srcDir, "components/quiz/WarmQuizApis.tsx"),
      "utf8",
    );
    expect(source).toMatch(/\/api\/quiz\/start/);
    expect(source).toMatch(/\/api\/quiz\/submit-answer/);
    expect(source).toMatch(/method: "GET"/);
  });
});
