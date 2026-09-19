import { describe, expect, it, vi } from "vitest";
import {
  consumeHeart,
  createQuizSession,
} from "@/lib/quiz/rpc-client";

describe("quiz RPC client", () => {
  it("creates a session from create_quiz_session", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ session_id: "sess-1" }],
      error: null,
    });

    const result = await createQuizSession(
      { rpc } as never,
      "survival",
    );

    expect(rpc).toHaveBeenCalledWith("create_quiz_session", {
      pack_id_param: "survival",
    });
    expect(result).toEqual({ sessionId: "sess-1" });
  });

  it("surfaces paid-pack permission errors from create_quiz_session", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Purchased pack permission required" },
    });

    await expect(
      createQuizSession({ rpc } as never, "travel"),
    ).rejects.toThrow(/Purchased pack permission required/);
  });

  it("returns remaining hearts from consume_heart without extra client math", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ remaining_hearts: 4, updated_at: "2026-09-06T00:00:00Z" }],
      error: null,
    });

    const result = await consumeHeart(
      { rpc } as never,
      "sess-1",
      "phrase-1",
    );

    expect(rpc).toHaveBeenCalledWith("consume_heart", {
      session_id_param: "sess-1",
      phrase_id_param: "phrase-1",
    });
    expect(result).toEqual({
      remainingHearts: 4,
      updatedAt: "2026-09-06T00:00:00Z",
    });
  });

  it("does not invent a heart decrement when consume_heart returns the same count", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ remaining_hearts: 3, updated_at: "2026-09-06T00:00:00Z" }],
      error: null,
    });

    const first = await consumeHeart({ rpc } as never, "sess-1", "phrase-1");
    const second = await consumeHeart({ rpc } as never, "sess-1", "phrase-1");

    expect(first.remainingHearts).toBe(3);
    expect(second.remainingHearts).toBe(3);
  });

  it("submits selected choice text to submit_answer for server-side grading", async () => {
    const { submitAnswer } = await import("@/lib/quiz/rpc-client");
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          is_correct: true,
          remaining_hearts: 5,
          updated_at: "2026-09-06T00:00:00Z",
          correct_choice_text: "Thank you",
        },
      ],
      error: null,
    });

    const result = await submitAnswer(
      { rpc } as never,
      "sess-1",
      "phrase-1",
      "Thank you",
      "en",
    );

    expect(rpc).toHaveBeenCalledWith("submit_answer", {
      session_id_param: "sess-1",
      phrase_id_param: "phrase-1",
      selected_choice_text: "Thank you",
      locale_param: "en",
    });
    expect(result).toEqual({
      isCorrect: true,
      remainingHearts: 5,
      updatedAt: "2026-09-06T00:00:00Z",
      correctChoiceText: "Thank you",
    });
  });
});
