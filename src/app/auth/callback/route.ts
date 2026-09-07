import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  AUTH_NEXT_COOKIE,
  decodeCookieValue,
  resolveAuthNextPath,
} from "@/lib/auth/oauth-redirect";

function redirectWithClearedCookie(target: URL) {
  const response = NextResponse.redirect(target);
  response.cookies.set(AUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = resolveAuthNextPath(
    url.searchParams.get("next"),
    decodeCookieValue(request.cookies.get(AUTH_NEXT_COOKIE)?.value),
  );

  if (!code) {
    return redirectWithClearedCookie(new URL(next, url.origin));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) {
    await supabase.rpc("sync_profile");
    return redirectWithClearedCookie(new URL(next, url.origin));
  }

  const failure = new URL(next, url.origin);
  failure.searchParams.set("authError", "generic");
  return redirectWithClearedCookie(failure);
}
