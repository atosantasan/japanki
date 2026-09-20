import { describe, expect, it } from "vitest";
import { shuffleChoices } from "@/lib/quiz/shuffle-choices";

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

describe("shuffleChoices", () => {
  it("recalculates the correct index from the correct text after shuffling", () => {
    const original = ["Thank you", "Sorry", "Hello"];
    const originalCorrectIndex = 0;
    const random = createSequenceRandom([0, 0]);

    const result = shuffleChoices(original, originalCorrectIndex, random);

    expect(result.choices[result.correctIndex]).toBe("Thank you");
    expect(result.correctIndex).not.toBe(originalCorrectIndex);
    expect(result.choices).toEqual(["Sorry", "Hello", "Thank you"]);
    expect(result.correctIndex).toBe(2);
  });

  it("keeps the correct answer mapped when the original index is in the middle", () => {
    const original = ["Sorry", "Thank you", "Hello"];
    const result = shuffleChoices(original, 1, () => 0);

    expect(result.choices[result.correctIndex]).toBe("Thank you");
    expect(result.choices).toHaveLength(3);
    expect([...result.choices].sort()).toEqual([...original].sort());
  });

  it("does not mutate the original choices array", () => {
    const original = ["A", "B", "C"];
    const snapshot = [...original];

    shuffleChoices(original, 2, createSequenceRandom([0.99, 0.99]));

    expect(original).toEqual(snapshot);
  });

  it("throws when the correct index is out of range", () => {
    expect(() => shuffleChoices(["A", "B", "C"], 3)).toThrow(
      /correctIndex is out of range/i,
    );
    expect(() => shuffleChoices(["A", "B", "C"], -1)).toThrow(
      /correctIndex is out of range/i,
    );
  });

  it("throws when the correct text is duplicated", () => {
    expect(() => shuffleChoices(["Yes", "Yes", "No"], 0)).toThrow(
      /unique/i,
    );
  });

  it("recalculates the correct index when the stored answer is last", () => {
    const original = ["Sorry", "Hello", "Thank you"];
    const result = shuffleChoices(
      original,
      2,
      createSequenceRandom([0, 0]),
    );

    expect(result.choices[result.correctIndex]).toBe("Thank you");
    expect(original[2]).toBe("Thank you");
    expect(result.choices).toHaveLength(3);
    expect([...result.choices].sort()).toEqual([...original].sort());
  });
});
