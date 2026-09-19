import { describe, expect, it } from "vitest";
import { shouldBypassServiceWorkerCache } from "@/lib/pwa/sw-bypass";

describe("shouldBypassServiceWorkerCache", () => {
  it("bypasses every supabase.co request including auth endpoints", () => {
    expect(
      shouldBypassServiceWorkerCache(
        new URL("https://abcdefgh.supabase.co/auth/v1/authorize?provider=google"),
      ),
    ).toBe(true);
    expect(
      shouldBypassServiceWorkerCache(
        new URL("https://abcdefgh.supabase.co/auth/v1/token"),
      ),
    ).toBe(true);
    expect(
      shouldBypassServiceWorkerCache(
        new URL("https://abcdefgh.supabase.co/rest/v1/profiles"),
      ),
    ).toBe(true);
  });

  it("bypasses Stripe and Google OAuth hosts plus the local auth callback", () => {
    expect(
      shouldBypassServiceWorkerCache(new URL("https://api.stripe.com/v1/checkout/sessions")),
    ).toBe(true);
    expect(
      shouldBypassServiceWorkerCache(
        new URL("https://accounts.google.com/o/oauth2/v2/auth"),
      ),
    ).toBe(true);
    expect(
      shouldBypassServiceWorkerCache(new URL("https://japanki.example/auth/callback?code=abc")),
    ).toBe(true);
  });

  it("bypasses same-origin API routes so grading is not queued by the worker", () => {
    expect(
      shouldBypassServiceWorkerCache(
        new URL("https://japanki.example/api/quiz/submit-answer"),
      ),
    ).toBe(true);
  });

  it("does not bypass same-origin app pages or font CDNs", () => {
    expect(shouldBypassServiceWorkerCache(new URL("https://japanki.example/ja"))).toBe(
      false,
    );
    expect(
      shouldBypassServiceWorkerCache(
        new URL("https://fonts.gstatic.com/s/outfit/v1/font.woff2"),
      ),
    ).toBe(false);
  });
});
