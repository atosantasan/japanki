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
    expect(source).toMatch(/disabled=\{Boolean\(feedback\)\}/);
    expect(source).not.toMatch(/!canPlayWithHearts\(hearts\)/);
  });

  it("checks recovered hearts before starting", () => {
    expect(source).toMatch(/recoveredHeartCount/);
    expect(source).toMatch(
      /recoveredHeartCount\(\{\s*storedHearts:\s*currentProfile\?\.hearts \?\? 5,\s*lastHeartUpdatedAt:\s*currentProfile\?\.lastHeartUpdatedAt,/,
    );
  });

  it("grades on the client before any server round trip", () => {
    const choose = source.slice(
      source.indexOf("onChoose"),
      source.indexOf("goNext"),
    );
    expect(choose).toMatch(/current\.correctChoiceText/);
    expect(choose).toMatch(/selectedText === current\.correctChoiceText/);
    expect(choose).not.toMatch(/requestSubmitAnswer/);
    expect(choose).not.toMatch(/await /);
    expect(choose.indexOf("setFeedback")).toBeGreaterThan(-1);
    expect(choose.indexOf("selectedText === current.correctChoiceText")).toBeLessThan(
      choose.indexOf("setFeedback"),
    );
  });
});
