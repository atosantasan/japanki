import { z } from "zod";
import { RATE_LIMIT_EXCEEDED_ERROR } from "@/lib/constants/app";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/locales";
import type {
  ConsumeHeartResult,
  SubmitAnswerResult,
} from "@/lib/quiz/rpc-client";

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
  submitAnswer: (
    sessionId: string,
    phraseId: string,
    selectedChoiceText: string,
    locale: SupportedLocale,
  ) => Promise<SubmitAnswerResult>;
};

export type SubmitAnswerResponse =
  | { status: 200; body: SubmitAnswerResult }
  | { status: 400 | 401 | 403 | 404 | 429 | 500; body: { error: string } };

export async function submitAnswerForRequest(
  input: SubmitAnswerBody,
  loader: SubmitAnswerLoader,
): Promise<SubmitAnswerResponse> {
  const user = await loader.getUser();
  if (!user) {
    return { status: 401, body: { error: "unauthenticated" } };
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

  try {
    const result = await loader.submitAnswer(
      input.sessionId,
      input.phraseId,
      input.selectedChoiceText,
      input.locale,
    );
    return { status: 200, body: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes(RATE_LIMIT_EXCEEDED_ERROR)) {
      return { status: 429, body: { error: RATE_LIMIT_EXCEEDED_ERROR } };
    }
    console.error("Failed to submit answer", error);
    return { status: 500, body: { error: "Unable to grade answer" } };
  }
}
