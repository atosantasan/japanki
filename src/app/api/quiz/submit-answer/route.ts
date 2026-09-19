import { NextResponse } from "next/server";
import { consumeHeart } from "@/lib/quiz/rpc-client";
import {
  SubmitAnswerBodySchema,
  submitAnswerForRequest,
  type SubmitAnswerLoader,
} from "@/lib/quiz/submit-answer";
import { recoveredHeartCount } from "@/lib/hearts/recovery";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function createSubmitAnswerLoader(
  request: Request,
): Promise<SubmitAnswerLoader> {
  const userClient = await createServerSupabaseClient();
  const adminClient = createAdminSupabaseClient();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : undefined;

  return {
    async getUser() {
      const { data, error } = token
        ? await userClient.auth.getUser(token)
        : await userClient.auth.getUser();
      if (error || !data.user) {
        return null;
      }
      return { id: data.user.id };
    },
    async getSessionOwner(sessionId) {
      const { data, error } = await userClient
        .from("quiz_sessions")
        .select("user_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data?.user_id ?? null;
    },
    async isPhraseAssigned(sessionId, phraseId) {
      const { data, error } = await userClient
        .from("quiz_session_questions")
        .select("id")
        .eq("session_id", sessionId)
        .eq("phrase_id", phraseId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return Boolean(data);
    },
    async getPhrase(phraseId) {
      const { data, error } = await adminClient
        .from("phrases")
        .select("choices_by_lang, correct_choice_index")
        .eq("id", phraseId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
    async getHearts(userId) {
      const { data, error } = await userClient
        .from("profiles")
        .select("hearts, last_heart_updated_at")
        .eq("id", userId)
        .maybeSingle();
      if (error || !data) {
        throw error ?? new Error("profile not found");
      }
      const updatedAt =
        typeof data.last_heart_updated_at === "string"
          ? data.last_heart_updated_at
          : new Date(data.last_heart_updated_at).toISOString();
      return {
        remainingHearts: recoveredHeartCount({
          storedHearts: data.hearts,
          lastHeartUpdatedAt: updatedAt,
        }),
        updatedAt,
      };
    },
    async consumeHeart(sessionId, phraseId) {
      return consumeHeart(
        {
          rpc: (fn, args) => userClient.rpc(fn, args),
        },
        sessionId,
        phraseId,
      );
    },
  };
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = SubmitAnswerBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const result = await submitAnswerForRequest(
      parsed.data,
      await createSubmitAnswerLoader(request),
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("submit-answer failed", error);
    return NextResponse.json({ error: "Unable to grade answer" }, { status: 500 });
  }
}
