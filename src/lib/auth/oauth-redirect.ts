import { safeNextPath } from "@/lib/auth/safe-redirect";

export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_NEXT_COOKIE = "japanki_auth_next";

export function authCallbackUrl(origin: string): string {
  return new URL(AUTH_CALLBACK_PATH, origin).toString();
}

export function persistAuthNextPath(nextPath: string): void {
  const safe = safeNextPath(nextPath);
  document.cookie = `${AUTH_NEXT_COOKIE}=${encodeURIComponent(safe)}; Path=/; Max-Age=600; SameSite=Lax`;
}

export function decodeCookieValue(
  raw: string | null | undefined,
): string | null {
  if (!raw) {
    return null;
  }
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function resolveAuthNextPath(
  queryNext: string | null | undefined,
  cookieNext: string | null | undefined,
): string {
  return safeNextPath(queryNext ?? cookieNext);
}

export function clearAuthNextCookie(
  setCookie: (name: string, value: string, options: { path: string; maxAge: number }) => void,
): void {
  setCookie(AUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
}
