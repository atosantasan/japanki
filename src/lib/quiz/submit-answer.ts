import { z } from "zod";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/locales";
import { gradeSelectedChoice } from "@/lib/quiz/grade-answer";
import type {
  ConsumeHeartResult,
  SubmitAnswerResult,
} from "@/lib/quiz/rpc-client";
import { ChoicesByLangSchema } from "@/lib/validation/translation-schema";

export const SubmitAnswerBodySchema = z.object({
  sessionId: z.string().uuid(),
  phraseId: z.string().uuid(),
  selectedChoiceText: z.string().min(1),
  locale: z.enum(SUPPORTED_LOCALES),
});

export type SubmitAnswerBody = {
  sessionId: string;
  phraseId: string;
  selectedChoiceText: string;
  locale: SupportedLocale;
};

export type GradePhrase = {
  choices_by_lang: unknown;
  correct_choice_index: unknown;
};

export type SubmitAnswerLoader = {
  getUser: () => Promise<{ id: string } | null>;
  getSessionOwner: (sessionId: string) => Promise<string | null>;
  isPhraseAssigned: (sessionId: string, phraseId: string) => Promise<boolean>;
  getPhrase: (phraseId: string) => Promise<GradePhrase | null>;
  getHearts: (userId: string) => Promise<ConsumeHeartResult>;
  consumeHeart: (
    sessionId: string,
    phraseId: string,
  ) => Promise<ConsumeHeartResult>;
};

export type SubmitAnswerResponse =
  | { status: 200; body: SubmitAnswerResult }
  | { status: 400 | 401 | 403 | 404 | 500; body: { error: string } };

const PhraseGradeSchema = z.object({
  choices_by_lang: ChoicesByLangSchema,
  correct_choice_index: z.number().int().min(0).max(2),
});

export async function submitAnswerForRequest(
  input: SubmitAnswerBody,
  loader: SubmitAnswerLoader,
): Promise<SubmitAnswerResponse> {
  const user = await loader.getUser();
  if (!user) {
    return { status: 401, body: { error: "unauthenticated" } };
  }

  const ownerId = await loader.getSessionOwner(input.sessionId);
  if (!ownerId || ownerId !== user.id) {
    return { status: 403, body: { error: "forbidden" } };
  }

  const assigned = await loader.isPhraseAssigned(input.sessionId, input.phraseId);
  if (!assigned) {
    return { status: 400, body: { error: "phrase not assigned" } };
  }

  const phrase = await loader.getPhrase(input.phraseId);
  if (!phrase) {
    return { status: 404, body: { error: "phrase not found" } };
  }

  const parsed = PhraseGradeSchema.safeParse(phrase);
  if (!parsed.success) {
    console.error("Phrase grade payload failed Zod validation");
    return { status: 500, body: { error: "Invalid phrase data" } };
  }

  let graded;
  try {
    graded = gradeSelectedChoice({
      selectedChoiceText: input.selectedChoiceText,
      choicesByLang: parsed.data.choices_by_lang,
      correctChoiceIndex: parsed.data.correct_choice_index,
      locale: input.locale,
    });
  } catch (error) {
    console.error("Failed to grade selected choice", error);
    return { status: 500, body: { error: "Unable to grade answer" } };
  }

  const hearts = graded.isCorrect
    ? await loader.getHearts(user.id)
    : await loader.consumeHeart(input.sessionId, input.phraseId);

  return {
    status: 200,
    body: {
      isCorrect: graded.isCorrect,
      remainingHearts: hearts.remainingHearts,
      updatedAt: hearts.updatedAt,
      correctChoiceText: graded.correctChoiceText,
    },
  };
}
