import { describe, expect, it } from "vitest";
import { canStartCheckout } from "@/lib/billing/checkout-guard";
import { findCustomerIdForPortal } from "@/lib/billing/portal";

describe("billing portal access", () => {
  it("reuses the checkout identity guard so guests cannot open the portal", () => {
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

  it("resolves the Stripe customer by email without granting a purchase", async () => {
    const result = await findCustomerIdForPortal({
      email: "traveler@example.com",
      listCustomers: async (email) => {
        expect(email).toBe("traveler@example.com");
        return [{ id: "cus_123" }];
      },
    });
    expect(result).toEqual({ ok: true, customerId: "cus_123" });
  });

  it("returns no_customer when Stripe has no customer for the email", async () => {
    await expect(
      findCustomerIdForPortal({
        email: "nobody@example.com",
        listCustomers: async () => [],
      }),
    ).resolves.toEqual({ ok: false, code: "no_customer" });
  });

  it("returns no_email when the linked user has no email", async () => {
    await expect(
      findCustomerIdForPortal({
        email: null,
        listCustomers: async () => [{ id: "cus_123" }],
      }),
    ).resolves.toEqual({ ok: false, code: "no_email" });
  });
});
