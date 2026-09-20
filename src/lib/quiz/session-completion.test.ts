import { describe, expect, it } from "vitest";
import { shouldMarkSessionComplete } from "@/lib/quiz/session-completion";

describe("shouldMarkSessionComplete", () => {
  it("marks complete when every assigned phrase has an answer", () => {
    expect(
      shouldMarkSessionComplete({
        answeredPhraseCount: 5,
        assignedQuestionCount: 5,
        completedAt: null,
      }),
    ).toBe(true);
  });

  it("stays incomplete when only some assigned phrases are answered", () => {
    expect(
      shouldMarkSessionComplete({
        answeredPhraseCount: 1,
        assignedQuestionCount: 5,
        completedAt: null,
      }),
    ).toBe(false);
  });

  it("compares against the assigned count instead of a hardcoded five", () => {
    expect(
      shouldMarkSessionComplete({
        answeredPhraseCount: 3,
        assignedQuestionCount: 3,
        completedAt: null,
      }),
    ).toBe(true);
  });

  it("does not rewrite completed_at once it is already set", () => {
    expect(
      shouldMarkSessionComplete({
        answeredPhraseCount: 5,
        assignedQuestionCount: 5,
        completedAt: "2026-09-21T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("stays incomplete when no questions are assigned", () => {
    expect(
      shouldMarkSessionComplete({
        answeredPhraseCount: 0,
        assignedQuestionCount: 0,
        completedAt: null,
      }),
    ).toBe(false);
  });
});
