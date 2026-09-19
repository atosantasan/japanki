import type { SupportedLocale } from "@/lib/i18n/locales";
import { toContentLocale } from "@/lib/i18n/locales";
import { shuffleChoiceOrder, type RandomFn } from "@/lib/quiz/shuffle-choices";
import type { PublicPhraseRecord } from "@/lib/validation/translation-schema";

export type PreparedQuestion = {
  phrase: PublicPhraseRecord;
  prompt: string;
  choices: string[];
};

export function prepareQuestion(
  phrase: PublicPhraseRecord,
  locale: SupportedLocale,
  random: RandomFn = Math.random,
): PreparedQuestion {
  const contentLocale = toContentLocale(locale);
  const choices = phrase.choices_by_lang[contentLocale];

  return {
    phrase,
    prompt: phrase.translations[contentLocale],
    choices: shuffleChoiceOrder(choices, random),
  };
}
