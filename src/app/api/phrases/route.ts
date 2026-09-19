import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadPhrasesForRequest } from "@/lib/phrases/load-phrases";
import type { PhraseRequestLoader } from "@/lib/phrases/load-phrases";

async function createPhrasesLoader(): Promise<PhraseRequestLoader> {
  const userClient = await createServerSupabaseClient();
  const adminClient = createAdminSupabaseClient();

  return {
    async getUser() {
      const { data, error } = await userClient.auth.getUser();
      if (error || !data.user) {
        return null;
      }
      return { id: data.user.id };
    },
    async getPack(packId) {
      const { data, error } = await adminClient
        .from("content_packs")
        .select("id, is_free")
        .eq("id", packId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
    async hasPurchase(userId, packId) {
      const { data, error } = await adminClient
        .from("user_purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("pack_id", packId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return Boolean(data);
    },
    async getPhrases(packId) {
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
  };
}

export async function GET(request: Request) {
  const packId = new URL(request.url).searchParams.get("pack_id");
  if (!packId) {
    return NextResponse.json({ error: "pack_id is required" }, { status: 400 });
  }

  const result = await loadPhrasesForRequest(packId, await createPhrasesLoader());
  return NextResponse.json(result.body, { status: result.status });
}
