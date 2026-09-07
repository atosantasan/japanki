export type RandomFn = () => number;

export type ShuffledChoices = {
  choices: string[];
  correctIndex: number;
};

export function shuffleChoices(
  choices: readonly string[],
  correctIndex: number,
  random: RandomFn = Math.random,
): ShuffledChoices {
  if (
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex >= choices.length
  ) {
    throw new Error("correctIndex is out of range");
  }

  const correctText = choices[correctIndex];
  if (correctText === undefined) {
    throw new Error("correctIndex is out of range");
  }

  if (new Set(choices).size !== choices.length) {
    throw new Error(
      "Choice texts must be unique so the correct answer can be located after shuffle",
    );
  }

  const shuffled = [...choices];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = shuffled[i];
    const swapTarget = shuffled[j];
    if (current === undefined || swapTarget === undefined) {
      throw new Error("Shuffle produced an undefined slot");
    }
    shuffled[i] = swapTarget;
    shuffled[j] = current;
  }

  const newCorrectIndex = shuffled.indexOf(correctText);
  if (newCorrectIndex === -1) {
    throw new Error("Correct choice text was lost during shuffle");
  }

  return {
    choices: shuffled,
    correctIndex: newCorrectIndex,
  };
}
