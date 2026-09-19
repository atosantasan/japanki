import { describe, expect, it, vi } from "vitest";
import { grantPurchase } from "@/lib/billing/grant-purchase";

describe("grantPurchase", () => {
  it("inserts a purchase row and reports duplicates as idempotent", async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: { code: "23505", message: "duplicate key" },
      });

    const admin = {
      from: vi.fn().mockReturnValue({
        insert: (row: unknown) => {
          void row;
          return insert();
        },
      }),
    };

    await expect(grantPurchase(admin, "user-1", "travel")).resolves.toBe(
      "inserted",
    );
    await expect(grantPurchase(admin, "user-1", "travel")).resolves.toBe(
      "duplicate",
    );
  });

  it("stores stripe_payment_intent_id when granting a purchase", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: vi.fn().mockReturnValue({
        insert,
      }),
    };

    await expect(
      grantPurchase(admin, "user-1", "travel", "pi_paid"),
    ).resolves.toBe("inserted");
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      pack_id: "travel",
      stripe_payment_intent_id: "pi_paid",
    });
  });
});
