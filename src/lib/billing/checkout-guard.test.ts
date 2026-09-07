import { describe, expect, it } from "vitest";
import { canStartCheckout } from "@/lib/billing/checkout-guard";

describe("canStartCheckout", () => {
  it("rejects missing auth", () => {
    expect(
      canStartCheckout({
        userId: null,
        isAnonymous: true,
        identityProviders: [],
      }),
    ).toEqual({ ok: false, status: 401, code: "unauthenticated" });
  });

  it("blocks anonymous profiles from checkout and requires identity linking", () => {
    expect(
      canStartCheckout({
        userId: "user-1",
        isAnonymous: true,
        identityProviders: ["anonymous"],
      }),
    ).toEqual({
      ok: false,
      status: 403,
      code: "identity_linking_required",
    });
  });

  it("blocks users with no non-anonymous identity even if the profile flag is stale", () => {
    expect(
      canStartCheckout({
        userId: "user-1",
        isAnonymous: false,
        identityProviders: ["anonymous"],
      }),
    ).toEqual({
      ok: false,
      status: 403,
      code: "identity_linking_required",
    });
  });

  it("allows checkout only when a Google or email identity is connected", () => {
    expect(
      canStartCheckout({
        userId: "user-1",
        isAnonymous: false,
        identityProviders: ["anonymous", "google"],
      }),
    ).toEqual({ ok: true });
  });
});
