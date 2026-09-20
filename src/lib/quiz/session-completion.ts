export function shouldMarkSessionComplete(input: {
  answeredPhraseCount: number;
  assignedQuestionCount: number;
  completedAt: string | null;
}): boolean {
  if (input.completedAt != null) {
    return false;
  }
  if (input.assignedQuestionCount <= 0) {
    return false;
  }
  return input.answeredPhraseCount === input.assignedQuestionCount;
}
