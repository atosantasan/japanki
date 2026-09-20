import { z } from "zod";
import {
  RATE_LIMIT_EXCEEDED_ERROR,
  SUBMIT_ANSWER_RATE_LIMIT_PER_HOUR,
} from "@/lib/constants/app";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/locales";
import { gradeSelectedChoice } from "@/lib/quiz/grade-answer";
import { consumeRateLimit } from "@/lib/security/rate-limit";
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

export type GradeContext = {
  ownerId: string | null;
  assigned: boolean;
  phrase: GradePhrase | null;
  hearts: ConsumeHeartResult | null;
};

export type SubmitAnswerLoader = {
  getUser: () => Promise<{ id: string } | null>;
  loadGradeContext: (
    sessionId: string,
    phraseId: string,
    userId: string,
  ) => Promise<GradeContext>;
  consumeHeart: (
    sessionId: string,
    phraseId: string,
  ) => Promise<ConsumeHeartResult>;
};

export type SubmitAnswerResponse =
  | { status: 200; body: SubmitAnswerResult }
  | { status: 400 | 401 | 403 | 404 | 429 | 500; body: { error: string } };

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
  if (
    !consumeRateLimit(
      `submit-answer:${user.id}`,
      SUBMIT_ANSWER_RATE_LIMIT_PER_HOUR,
    )
  ) {
    return { status: 429, body: { error: RATE_LIMIT_EXCEEDED_ERROR } };
  }

  const context = await loader.loadGradeContext(
    input.sessionId,
    input.phraseId,
    user.id,
  );
  if (!context.ownerId || context.ownerId !== user.id) {
    return { status: 403, body: { error: "forbidden" } };
  }
  if (!context.assigned) {
    return { status: 400, body: { error: "phrase not assigned" } };
  }
  if (!context.phrase) {
    return { status: 404, body: { error: "phrase not found" } };
  }
  if (!context.hearts) {
    return { status: 500, body: { error: "Unable to grade answer" } };
  }
  if (context.hearts.remainingHearts <= 0) {
    return { status: 403, body: { error: "No hearts remaining" } };
  }

  const parsed = PhraseGradeSchema.safeParse(context.phrase);
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
    ? context.hearts
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
