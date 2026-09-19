import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const quizPlayPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../components/quiz/QuizPlay.tsx",
);

describe("QuizPlay hearts empty warning", () => {
  const source = readFileSync(quizPlayPath, "utf8");

  it("uses recovered hearts instead of the raw stored count for heartsEmpty", () => {
    expect(source).toMatch(/shouldShowHeartsEmpty/);
    expect(source).not.toMatch(/hearts === 0 && feedback/);
  });

  it("does not disable answer buttons when hearts are empty", () => {
    expect(source).toMatch(/disabled=\{Boolean\(feedback\)\}/);
    expect(source).not.toMatch(/disabled=\{.*hearts/);
  });

  it("surfaces submitAnswer failures instead of swallowing them", () => {
    expect(source).toMatch(/submitError/);
    expect(source).toMatch(/catch/);
    expect(source).toMatch(/requestSubmitAnswer/);
    expect(source).toMatch(/gradeError/);
  });
});
