import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) {
    await supabase.rpc("sync_profile");
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const failure = new URL(next, url.origin);
  failure.searchParams.set("authError", "generic");
  return NextResponse.redirect(failure);
}
