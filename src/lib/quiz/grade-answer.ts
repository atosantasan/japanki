import type { SupportedLocale } from "@/lib/i18n/locales";
import { toContentLocale } from "@/lib/i18n/locales";
import type { ChoicesByLang } from "@/lib/validation/translation-schema";

export type GradeSelectedChoiceInput = {
  selectedChoiceText: string;
  choicesByLang: ChoicesByLang;
  correctChoiceIndex: number;
  locale: SupportedLocale;
};

export type GradeSelectedChoiceResult = {
  isCorrect: boolean;
  correctChoiceText: string;
};

export function gradeSelectedChoice(
  input: GradeSelectedChoiceInput,
): GradeSelectedChoiceResult {
  const contentLocale = toContentLocale(input.locale);
  const choices = input.choicesByLang[contentLocale];
  const correctChoiceText = choices[input.correctChoiceIndex];
  if (!correctChoiceText) {
    throw new Error("Correct choice is missing");
  }

  return {
    isCorrect: input.selectedChoiceText === correctChoiceText,
    correctChoiceText,
  };
}
