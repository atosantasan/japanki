import { NextResponse } from "next/server";
import { consumeHeart } from "@/lib/quiz/rpc-client";
import { recoveredHeartCount } from "@/lib/hearts/recovery";
import {
  SubmitAnswerBodySchema,
  submitAnswerForRequest,
  type GradeContext,
  type SubmitAnswerLoader,
} from "@/lib/quiz/submit-answer";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function toUpdatedAt(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

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
    async loadGradeContext(sessionId, phraseId, userId): Promise<GradeContext> {
      const [sessionRes, assignedRes, phraseRes, heartsRes] = await Promise.all([
        adminClient
          .from("quiz_sessions")
          .select("user_id")
          .eq("id", sessionId)
          .maybeSingle(),
        adminClient
          .from("quiz_session_questions")
          .select("id")
          .eq("session_id", sessionId)
          .eq("phrase_id", phraseId)
          .maybeSingle(),
        adminClient
          .from("phrases")
          .select("choices_by_lang, correct_choice_index")
          .eq("id", phraseId)
          .maybeSingle(),
        adminClient
          .from("profiles")
          .select("hearts, last_heart_updated_at")
          .eq("id", userId)
          .maybeSingle(),
      ]);

      if (sessionRes.error) {
        throw sessionRes.error;
      }
      if (assignedRes.error) {
        throw assignedRes.error;
      }
      if (phraseRes.error) {
        throw phraseRes.error;
      }
      if (heartsRes.error) {
        throw heartsRes.error;
      }

      const updatedAt = toUpdatedAt(heartsRes.data?.last_heart_updated_at);
      const storedHearts = heartsRes.data?.hearts;

      return {
        ownerId: sessionRes.data?.user_id ?? null,
        assigned: Boolean(assignedRes.data),
        phrase: phraseRes.data,
        hearts:
          typeof storedHearts === "number" && updatedAt
            ? {
                remainingHearts: recoveredHeartCount({
                  storedHearts,
                  lastHeartUpdatedAt: updatedAt,
                }),
                updatedAt,
              }
            : null,
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

export async function GET() {
  return new NextResponse(null, { status: 204 });
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
