import { describe, expect, it } from "vitest";
import {
  AUTH_CALLBACK_PATH,
  AUTH_NEXT_COOKIE,
  authCallbackUrl,
  resolveAuthNextPath,
} from "@/lib/auth/oauth-redirect";

describe("authCallbackUrl", () => {
  it("returns a query-free callback URL that can match Supabase redirect allowlists", () => {
    expect(authCallbackUrl("https://japanki.example")).toBe(
      "https://japanki.example/auth/callback",
    );
    expect(authCallbackUrl("https://japanki.example/")).toBe(
      "https://japanki.example/auth/callback",
    );
    expect(authCallbackUrl("https://japanki.example")).not.toContain("?");
    expect(AUTH_CALLBACK_PATH).toBe("/auth/callback");
  });
});

describe("resolveAuthNextPath", () => {
  it("prefers the query next path when present", () => {
    expect(resolveAuthNextPath("/ja/account", "/en")).toBe("/ja/account");
  });

  it("falls back to the cookie next path", () => {
    expect(resolveAuthNextPath(null, "/ja")).toBe("/ja");
    expect(AUTH_NEXT_COOKIE).toBe("japanki_auth_next");
  });

  it("rejects open redirects from either source", () => {
    expect(resolveAuthNextPath("https://evil.test", "/ja")).toBe("/");
    expect(resolveAuthNextPath(null, "//evil.test")).toBe("/");
  });
});
