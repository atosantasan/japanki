import { z } from "zod";
import { buildQuizQueue } from "@/lib/quiz/build-queue";
import { gradeSelectedChoice } from "@/lib/quiz/grade-answer";
import { prepareQuestion, type PreparedQuestion } from "@/lib/quiz/prepare-question";
import type { ConsumeHeartResult } from "@/lib/quiz/rpc-client";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/locales";
import {
  PhraseRecordSchema,
  PublicPhraseRecordSchema,
} from "@/lib/validation/translation-schema";

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
  | { status: 401 | 403 | 404 | 500; body: { error: string } };

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
    console.error("Failed to create quiz session", error);
    return { status: 500, body: { error: "Unable to start quiz" } };
  }

  try {
    const [assigned, phraseRows, hearts] = await Promise.all([
      loader.loadAssigned(sessionId),
      loader.loadPhrases(input.packId),
      loader.getHearts(user.id),
    ]);

    const parsed = PhraseRecordSchema.array().safeParse(phraseRows);
    if (!parsed.success) {
      console.error("Phrase payload failed Zod validation");
      return { status: 500, body: { error: "Invalid phrase data" } };
    }

    const publicPhrases = parsed.data.map((phrase) =>
      PublicPhraseRecordSchema.parse(phrase),
    );
    const ordered = buildQuizQueue({
      packId: input.packId,
      assigned,
      phrases: publicPhrases,
    });
    const byId = new Map(parsed.data.map((phrase) => [phrase.id, phrase]));

    const questions = ordered.map((phrase) => {
      const full = byId.get(phrase.id);
      if (!full) {
        throw new Error("Assigned phrase is missing from the pack payload");
      }
      const graded = gradeSelectedChoice({
        selectedChoiceText: "",
        choicesByLang: full.choices_by_lang,
        correctChoiceIndex: full.correct_choice_index,
        locale: input.locale,
      });
      return prepareQuestion(phrase, input.locale, graded.correctChoiceText);
    });

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
