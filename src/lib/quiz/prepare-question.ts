import type { SupportedLocale } from "@/lib/i18n/locales";
import { toContentLocale } from "@/lib/i18n/locales";
import { shuffleChoices, type RandomFn } from "@/lib/quiz/shuffle-choices";
import type { PhraseRecord } from "@/lib/validation/translation-schema";

export type PreparedQuestionPhrase = Pick<
  PhraseRecord,
  "id" | "pack_id" | "romaji" | "japanese" | "audio_url"
>;

export type PreparedQuestion = {
  phrase: PreparedQuestionPhrase;
  choices: string[];
  correctChoiceText: string;
};

export function prepareQuestion(
  phrase: PhraseRecord,
  locale: SupportedLocale,
  random: RandomFn = Math.random,
): PreparedQuestion {
  const contentLocale = toContentLocale(locale);
  const sourceChoices = phrase.choices_by_lang[contentLocale];
  const shuffled = shuffleChoices(
    sourceChoices,
    phrase.correct_choice_index,
    random,
  );
  const correctChoiceText = shuffled.choices[shuffled.correctIndex];
  if (!correctChoiceText) {
    throw new Error("Correct choice text was lost during shuffle");
  }

  return {
    phrase: {
      id: phrase.id,
      pack_id: phrase.pack_id,
      romaji: phrase.romaji,
      japanese: phrase.japanese,
      audio_url: phrase.audio_url,
    },
    choices: shuffled.choices,
    correctChoiceText,
  };
}
