import { describe, expect, it } from "vitest";
import {
  canStartCheckout,
  rejectIfAlreadyOwned,
} from "@/lib/billing/checkout-guard";

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

describe("rejectIfAlreadyOwned", () => {
  it("blocks checkout with 400 when the pack is already owned", () => {
    expect(rejectIfAlreadyOwned(true)).toEqual({
      ok: false,
      status: 400,
      code: "already_purchased",
      error: "既に購入済みのパックです",
    });
  });

  it("allows checkout when the pack is not owned", () => {
    expect(rejectIfAlreadyOwned(false)).toEqual({ ok: true });
  });
});
