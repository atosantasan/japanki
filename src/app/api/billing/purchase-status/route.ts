import { NextResponse } from "next/server";
import { getPurchaseStatusForRequest } from "@/lib/billing/purchase-status";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const packId = new URL(request.url).searchParams.get("pack_id") ?? "";
  const userClient = await createServerSupabaseClient();

  const result = await getPurchaseStatusForRequest(packId, {
    async getUser() {
      const { data, error } = await userClient.auth.getUser();
      if (error || !data.user) {
        return null;
      }
      return { id: data.user.id };
    },
    async hasPurchase(userId, id) {
      const { data, error } = await userClient
        .from("user_purchases")
        .select("pack_id")
        .eq("user_id", userId)
        .eq("pack_id", id)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return Boolean(data);
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
