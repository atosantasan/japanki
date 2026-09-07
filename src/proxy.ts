import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { attachSupabaseSession } from "@/lib/supabase/session-proxy";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);
  return attachSupabaseSession(request, response);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|auth|.*\\..*).*)",
};
