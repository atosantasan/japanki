import { z } from "zod";
import { RATE_LIMIT_EXCEEDED_ERROR } from "@/lib/constants/app";
import { buildQuizQueue } from "@/lib/quiz/build-queue";
import { prepareQuestion, type PreparedQuestion } from "@/lib/quiz/prepare-question";
import type { ConsumeHeartResult } from "@/lib/quiz/rpc-client";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/locales";
import { PublicPhraseRecordSchema } from "@/lib/validation/translation-schema";

export const StartQuizBodySchema = z.object({
  packId: z.string().min(1),
  locale: z.enum(SUPPORTED_LOCALES),
});

export type StartQuizBody = {
  packId: string;
  locale: SupportedLocale;
};

export type StartQuizLoader = {
  getUser: () => Promise<{ id: string } | null>;
  createSession: (packId: string) => Promise<string>;
  loadAssigned: (
    sessionId: string,
  ) => Promise<{ phrase_id: string; position: number }[]>;
  loadPhrases: (packId: string) => Promise<unknown[]>;
  getHearts: (userId: string) => Promise<ConsumeHeartResult>;
};

export type StartQuizResult = {
  sessionId: string;
  remainingHearts: number;
  updatedAt: string;
  questions: PreparedQuestion[];
};

export type StartQuizResponse =
  | { status: 200; body: StartQuizResult }
  | { status: 401 | 403 | 404 | 429 | 500; body: { error: string } };

export async function startQuizForRequest(
  input: StartQuizBody,
  loader: StartQuizLoader,
): Promise<StartQuizResponse> {
  const user = await loader.getUser();
  if (!user) {
    return { status: 401, body: { error: "unauthenticated" } };
  }

  let sessionId: string;
  try {
    sessionId = await loader.createSession(input.packId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Purchased pack permission required")) {
      return { status: 403, body: { error: message } };
    }
    if (message.includes("Content pack not found")) {
      return { status: 404, body: { error: message } };
    }
    if (message.includes(RATE_LIMIT_EXCEEDED_ERROR)) {
      return { status: 429, body: { error: RATE_LIMIT_EXCEEDED_ERROR } };
    }
    console.error("Failed to create quiz session", error);
    return { status: 500, body: { error: "Unable to start quiz" } };
  }

  try {
    const [assigned, phraseRows, hearts] = await Promise.all([
      loader.loadAssigned(sessionId),
      loader.loadPhrases(input.packId),
      loader.getHearts(user.id),
    ]);

    const parsed = PublicPhraseRecordSchema.array().safeParse(phraseRows);
    if (!parsed.success) {
      console.error("Phrase payload failed Zod validation");
      return { status: 500, body: { error: "Invalid phrase data" } };
    }

    const ordered = buildQuizQueue({
      packId: input.packId,
      assigned,
      phrases: parsed.data,
    });
    const questions = ordered.map((phrase) =>
      prepareQuestion(phrase, input.locale),
    );

    return {
      status: 200,
      body: {
        sessionId,
        remainingHearts: hearts.remainingHearts,
        updatedAt: hearts.updatedAt,
        questions,
      },
    };
  } catch (error) {
    console.error("Failed to load quiz questions", error);
    return { status: 500, body: { error: "Unable to start quiz" } };
  }
}
