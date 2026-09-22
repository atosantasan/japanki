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

  it("blocks quiz start when recovered hearts are empty", () => {
    expect(source).toMatch(/canPlayWithHearts\(playableHearts\)/);
    expect(source).toMatch(/setErrorKey\("heartsEmpty"\)/);
    expect(source).toMatch(/NO_HEARTS_REMAINING_ERROR/);
    expect(source).not.toMatch(/hearts === 0 && feedback/);
  });

  it("keeps answer buttons enabled after the session heart is spent", () => {
    expect(source).toMatch(
      /disabled=\{\s*Boolean\(feedback\) \|\| submitting\s*\}/,
    );
    expect(source).not.toMatch(/!canPlayWithHearts\(hearts\)/);
  });

  it("checks recovered hearts before starting", () => {
    expect(source).toMatch(/recoveredHeartCount/);
    expect(source).toMatch(
      /recoveredHeartCount\(\{\s*storedHearts:\s*currentProfile\?\.hearts \?\? 5,\s*lastHeartUpdatedAt:\s*currentProfile\?\.lastHeartUpdatedAt,/,
    );
  });

  it("surfaces submitAnswer failures instead of swallowing them", () => {
    expect(source).toMatch(/submitError/);
    expect(source).toMatch(/catch/);
    expect(source).toMatch(/requestSubmitAnswer/);
    expect(source).toMatch(/gradeError/);
  });

  it("shows a recoverable invalidChoice screen instead of crashing", () => {
    expect(source).toMatch(/invalidChoice/);
    expect(source).toMatch(/INVALID_CHOICE_ERROR/);
    expect(source).toMatch(/reloadQuiz/);
    expect(source).toMatch(/window\.location\.reload/);
  });

  it("grades from submit-answer instead of a local correctChoiceText compare", () => {
    const choose = source.slice(
      source.indexOf("onChoose"),
      source.indexOf("goNext"),
    );
    expect(choose).toMatch(/await requestSubmitAnswer/);
    expect(choose).toMatch(/result\.isCorrect/);
    expect(choose).toMatch(/result\.correctChoiceText/);
    expect(choose).not.toMatch(/current\.correctChoiceText/);
    expect(choose).not.toMatch(/selectedText ===/);
    expect(choose.match(/requestSubmitAnswer/g)).toHaveLength(1);
    expect(choose.indexOf("await requestSubmitAnswer")).toBeLessThan(
      choose.indexOf("setFeedback"),
    );
  });
});
