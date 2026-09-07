import { describe, expect, it } from "vitest";
import { shuffleChoices } from "@/lib/quiz/shuffle-choices";
import { isCorrectChoice } from "@/lib/quiz/grade-choice";

function createSequenceRandom(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    if (value === undefined) {
      throw new Error("Random sequence exhausted");
    }
    return value;
  };
}

describe("quiz choice grading after shuffleChoices", () => {
  it("does not treat the original stored index as correct after a shuffle", () => {
    const storedChoices = ["Thank you", "Sorry", "Hello"];
    const storedCorrectIndex = 0;
    const shuffled = shuffleChoices(
      storedChoices,
      storedCorrectIndex,
      createSequenceRandom([0, 0]),
    );

    expect(shuffled.choices).toEqual(["Sorry", "Hello", "Thank you"]);
    expect(shuffled.correctIndex).toBe(2);
    expect(isCorrectChoice(0, shuffled.correctIndex)).toBe(false);
    expect(isCorrectChoice(2, shuffled.correctIndex)).toBe(true);
    expect(shuffled.choices[shuffled.correctIndex]).toBe("Thank you");
  });

  it("keeps grading stable across many shuffles of the same phrase", () => {
    const storedChoices = ["Water, please", "Check please", "Good morning"];
    const storedCorrectIndex = 0;

    for (let seed = 0; seed < 12; seed += 1) {
      let value = (seed + 1) / 13;
      const random = () => {
        value = (value * 11) % 1;
        return value;
      };
      const shuffled = shuffleChoices(
        storedChoices,
        storedCorrectIndex,
        random,
      );
      expect(isCorrectChoice(shuffled.correctIndex, shuffled.correctIndex)).toBe(
        true,
      );
      expect(shuffled.choices[shuffled.correctIndex]).toBe("Water, please");
    }
  });
});
