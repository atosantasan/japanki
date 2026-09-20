import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("quiz start stability", () => {
  it("keeps updateHearts identity stable with useCallback", () => {
    const source = readFileSync(
      join(srcDir, "components/auth/AuthProvider.tsx"),
      "utf8",
    );
    expect(source).toMatch(/const updateHearts = useCallback\(/);
  });

  it("does not restart the quiz bootstrap effect when hearts update", () => {
    const source = readFileSync(
      join(srcDir, "components/quiz/QuizPlay.tsx"),
      "utf8",
    );
    expect(source).toMatch(
      /}, \[authLoading, locale, packId, updateHearts, refreshProfile\]\);/,
    );
    expect(source).toMatch(/requestStartQuiz/);
    expect(source).not.toMatch(/createQuizSession/);
    expect(source).not.toMatch(/\/api\/phrases/);
  });

  it("refetches owned packs once before locking a paid quiz", () => {
    const source = readFileSync(
      join(srcDir, "components/quiz/QuizPlay.tsx"),
      "utf8",
    );
    expect(source).toMatch(/await refreshProfile\(\)/);
    expect(source).toMatch(/paidLockedHint/);
    const start = source.indexOf("Purchased pack permission required");
    const snippet = source.slice(Math.max(0, start - 200), start + 500);
    expect(snippet).toMatch(/refreshProfile/);
    expect(snippet).toMatch(/requestStartQuiz/);
  });
});
