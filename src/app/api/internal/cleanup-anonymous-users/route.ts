import { NextResponse } from "next/server";
import { ANONYMOUS_RETENTION_DAYS } from "@/lib/constants/app";
import { handleAnonymousCleanupRequest } from "@/lib/auth/cleanup-anonymous-users";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const DAY_MS = 24 * 60 * 60 * 1000;

function createAnonymousCleanupStore() {
  const admin = createAdminSupabaseClient();
  const cutoff = new Date(
    Date.now() - ANONYMOUS_RETENTION_DAYS * DAY_MS,
  ).toISOString();

  return {
    async listAnonymousProfiles() {
      const { data, error } = await admin
        .from("profiles")
        .select("id, is_anonymous, created_at")
        .eq("is_anonymous", true)
        .lte("created_at", cutoff);
      if (error) {
        throw error;
      }
      return data ?? [];
    },
    async listPurchasedUserIds(userIds: string[]) {
      if (userIds.length === 0) {
        return [];
      }
      const { data, error } = await admin
        .from("user_purchases")
        .select("user_id")
        .in("user_id", userIds);
      if (error) {
        throw error;
      }
      return [
        ...new Set(
          (data ?? [])
            .map((row) => row.user_id)
            .filter((userId): userId is string => typeof userId === "string"),
        ),
      ];
    },
    async deleteAuthUser(userId: string) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        throw error;
      }
    },
  };
}

async function runCleanup(request: Request) {
  const result = await handleAnonymousCleanupRequest({
    authorizationHeader: request.headers.get("authorization"),
    cronSecret: process.env.CRON_SECRET,
    store: createAnonymousCleanupStore(),
  });
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET(request: Request) {
  return runCleanup(request);
}

export async function POST(request: Request) {
  return runCleanup(request);
}
