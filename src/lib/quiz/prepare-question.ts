import type { SupportedLocale } from "@/lib/i18n/locales";
import { shuffleChoices, type RandomFn } from "@/lib/quiz/shuffle-choices";
import type { PhraseRecord } from "@/lib/validation/translation-schema";

export type PreparedQuestion = {
  phrase: PhraseRecord;
  prompt: string;
  choices: string[];
  correctIndex: number;
};

export function prepareQuestion(
  phrase: PhraseRecord,
  locale: SupportedLocale,
  random: RandomFn = Math.random,
): PreparedQuestion {
  const choices = phrase.choices_by_lang[locale];
  const shuffled = shuffleChoices(
    choices,
    phrase.correct_choice_index,
    random,
  );

  return {
    phrase,
    prompt: phrase.translations[locale],
    choices: shuffled.choices,
    correctIndex: shuffled.correctIndex,
  };
}
