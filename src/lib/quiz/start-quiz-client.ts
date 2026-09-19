import type { StartQuizBody, StartQuizResult } from "@/lib/quiz/start-quiz";

export async function requestStartQuiz(
  input: StartQuizBody,
): Promise<StartQuizResult> {
  const response = await fetch("/api/quiz/start", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      json &&
      typeof json === "object" &&
      "error" in json &&
      typeof json.error === "string"
        ? json.error
        : "Unable to start quiz";
    throw new Error(message);
  }
  if (
    !json ||
    typeof json !== "object" ||
    typeof (json as StartQuizResult).sessionId !== "string" ||
    !Array.isArray((json as StartQuizResult).questions) ||
    (json as StartQuizResult).questions.length !== 5
  ) {
    throw new Error("Unable to start quiz");
  }
  return json as StartQuizResult;
}
