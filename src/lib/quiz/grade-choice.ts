export function isCorrectChoice(
  selectedIndex: number,
  shuffledCorrectIndex: number,
): boolean {
  return selectedIndex === shuffledCorrectIndex;
}
