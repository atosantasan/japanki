import type { SubmitAnswerResult } from "@/lib/quiz/rpc-client";
import type { SubmitAnswerBody } from "@/lib/quiz/submit-answer";

function errorFromBody(json: unknown): string {
  if (json && typeof json === "object" && "error" in json) {
    const error = (json as { error: unknown }).error;
    if (typeof error === "string" && error.length > 0) {
      return error;
    }
  }
  return "Unable to grade answer";
}

export async function requestSubmitAnswer(
  input: SubmitAnswerBody,
): Promise<SubmitAnswerResult> {
  const response = await fetch("/api/quiz/submit-answer", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(errorFromBody(json));
  }
  if (
    !json ||
    typeof json !== "object" ||
    typeof (json as SubmitAnswerResult).isCorrect !== "boolean" ||
    typeof (json as SubmitAnswerResult).remainingHearts !== "number" ||
    typeof (json as SubmitAnswerResult).updatedAt !== "string" ||
    typeof (json as SubmitAnswerResult).correctChoiceText !== "string" ||
    (json as SubmitAnswerResult).correctChoiceText.length === 0
  ) {
    throw new Error("Unable to grade answer");
  }

  const body = json as SubmitAnswerResult;
  return {
    isCorrect: body.isCorrect,
    remainingHearts: body.remainingHearts,
    updatedAt: body.updatedAt,
    correctChoiceText: body.correctChoiceText,
  };
}
