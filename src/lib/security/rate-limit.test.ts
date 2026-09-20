import { afterEach, describe, expect, it } from "vitest";
import {
  SUBMIT_ANSWER_RATE_LIMIT_PER_HOUR,
  QUIZ_START_RATE_LIMIT_PER_HOUR,
} from "@/lib/constants/app";
import {
  consumeRateLimit,
  resetRateLimitStoreForTests,
} from "@/lib/security/rate-limit";

describe("consumeRateLimit", () => {
  afterEach(() => {
    resetRateLimitStoreForTests();
  });

  it("allows requests up to the limit and rejects the next one", () => {
    expect(QUIZ_START_RATE_LIMIT_PER_HOUR).toBe(20);
    expect(SUBMIT_ANSWER_RATE_LIMIT_PER_HOUR).toBe(60);

    const windowMs = 60 * 60 * 1000;
    const now = 1_000_000;

    for (let i = 0; i < 60; i += 1) {
      expect(
        consumeRateLimit("submit-answer:user-1", 60, windowMs, now + i),
      ).toBe(true);
    }

    expect(
      consumeRateLimit("submit-answer:user-1", 60, windowMs, now + 60),
    ).toBe(false);
  });

  it("tracks keys independently so another user is not blocked", () => {
    const windowMs = 60 * 60 * 1000;
    const now = 1_000_000;

    for (let i = 0; i < 60; i += 1) {
      consumeRateLimit("submit-answer:user-1", 60, windowMs, now);
    }

    expect(consumeRateLimit("submit-answer:user-2", 60, windowMs, now)).toBe(
      true,
    );
  });

  it("allows a new request after the sliding window expires", () => {
    const windowMs = 60 * 60 * 1000;
    const now = 1_000_000;

    for (let i = 0; i < 20; i += 1) {
      consumeRateLimit("quiz-start:user-1", 20, windowMs, now);
    }

    expect(consumeRateLimit("quiz-start:user-1", 20, windowMs, now + 1)).toBe(
      false,
    );
    expect(
      consumeRateLimit("quiz-start:user-1", 20, windowMs, now + windowMs + 1),
    ).toBe(true);
  });
});
