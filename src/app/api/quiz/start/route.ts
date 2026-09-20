import { NextResponse } from "next/server";
import { recoveredHeartCount } from "@/lib/hearts/recovery";
import { createQuizSession } from "@/lib/quiz/rpc-client";
import {
  StartQuizBodySchema,
  startQuizForRequest,
  type StartQuizLoader,
} from "@/lib/quiz/start-quiz";
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

async function createStartQuizLoader(
  request: Request,
): Promise<StartQuizLoader> {
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
    async createSession(packId) {
      const created = await createQuizSession(
        {
          rpc: (fn, args) => userClient.rpc(fn, args),
        },
        packId,
      );
      return created.sessionId;
    },
    async loadAssigned(sessionId) {
      const { data, error } = await adminClient
        .from("quiz_session_questions")
        .select("phrase_id, position")
        .eq("session_id", sessionId);
      if (error) {
        throw error;
      }
      return data ?? [];
    },
    async loadPhrases(packId) {
      const { data, error } = await adminClient
        .from("phrases")
        .select(
          "id, pack_id, romaji, japanese, audio_url, translations, choices_by_lang",
        )
        .eq("pack_id", packId)
        .order("sort_order", { ascending: true });
      if (error) {
        throw error;
      }
      return data ?? [];
    },
    async getHearts(userId) {
      const { data, error } = await adminClient
        .from("profiles")
        .select("hearts, last_heart_updated_at")
        .eq("id", userId)
        .maybeSingle();
      if (error || !data) {
        throw error ?? new Error("profile not found");
      }
      const updatedAt = toUpdatedAt(data.last_heart_updated_at);
      if (typeof data.hearts !== "number" || !updatedAt) {
        throw new Error("Heart state was not returned");
      }
      return {
        remainingHearts: recoveredHeartCount({
          storedHearts: data.hearts,
          lastHeartUpdatedAt: updatedAt,
        }),
        updatedAt,
      };
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

  const parsed = StartQuizBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const result = await startQuizForRequest(
      parsed.data,
      await createStartQuizLoader(request),
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("quiz start failed", error);
    return NextResponse.json({ error: "Unable to start quiz" }, { status: 500 });
  }
}
