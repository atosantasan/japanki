import type { SupportedLocale } from "@/lib/i18n/locales";
import { toContentLocale } from "@/lib/i18n/locales";
import { shuffleChoiceOrder, type RandomFn } from "@/lib/quiz/shuffle-choices";
import type { PublicPhraseRecord } from "@/lib/validation/translation-schema";

export type PreparedQuestionPhrase = Pick<
  PublicPhraseRecord,
  "id" | "pack_id" | "romaji" | "japanese" | "audio_url"
>;

export type PreparedQuestion = {
  phrase: PreparedQuestionPhrase;
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
    phrase: {
      id: phrase.id,
      pack_id: phrase.pack_id,
      romaji: phrase.romaji,
      japanese: phrase.japanese,
      audio_url: phrase.audio_url,
    },
    choices: shuffleChoiceOrder(choices, random),
  };
}
