import { describe, expect, it, vi } from "vitest";
import { revokePurchaseByPaymentIntent } from "@/lib/billing/revoke-purchase";

describe("revokePurchaseByPaymentIntent", () => {
  it("deletes the purchase row matched by stripe_payment_intent_id", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [{ id: "purchase-1" }],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ select });
    const del = vi.fn().mockReturnValue({ eq });
    const admin = {
      from: vi.fn().mockReturnValue({
        delete: del,
      }),
    };

    await expect(
      revokePurchaseByPaymentIntent(admin, "pi_refund"),
    ).resolves.toBe("revoked");
    expect(admin.from).toHaveBeenCalledWith("user_purchases");
    expect(eq).toHaveBeenCalledWith("stripe_payment_intent_id", "pi_refund");
  });

  it("reports not_found when no purchase row matches", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ select });
    const admin = {
      from: vi.fn().mockReturnValue({
        delete: () => ({ eq }),
      }),
    };

    await expect(
      revokePurchaseByPaymentIntent(admin, "pi_missing"),
    ).resolves.toBe("not_found");
  });
});
