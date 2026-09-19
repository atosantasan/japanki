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

  it("locks answering from remaining hearts instead of a raw stored zero", () => {
    expect(source).toMatch(/canPlayWithHearts/);
    expect(source).not.toMatch(/hearts === 0 && feedback/);
  });

  it("disables answer buttons when remaining hearts are empty", () => {
    expect(source).toMatch(/disabled=\{Boolean\(feedback\) \|\| !canPlayWithHearts\(hearts\)\}/);
    expect(source).toMatch(/!canPlayWithHearts\(hearts\)/);
  });

  it("surfaces submitAnswer failures instead of swallowing them", () => {
    expect(source).toMatch(/submitError/);
    expect(source).toMatch(/catch/);
    expect(source).toMatch(/requestSubmitAnswer/);
    expect(source).toMatch(/gradeError/);
  });

  it("shows local feedback before waiting for submit-answer", () => {
    const choose = source.slice(
      source.indexOf("onChoose"),
      source.indexOf("goNext"),
    );
    expect(choose).toMatch(/selectedText === current.correctChoiceText/);
    expect(choose.indexOf("setFeedback")).toBeLessThan(
      choose.indexOf("requestSubmitAnswer"),
    );
    expect(choose).not.toMatch(/await requestSubmitAnswer/);
  });
});
