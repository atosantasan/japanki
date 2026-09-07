import { describe, expect, it, vi } from "vitest";
import { handleStripeWebhook } from "@/lib/billing/stripe-webhook";

const completedEvent = {
  type: "checkout.session.completed",
  data: {
    object: {
      metadata: {
        supabase_user_id: "user-1",
        pack_id: "travel",
      },
    },
  },
};

describe("handleStripeWebhook", () => {
  it("rejects invalid signatures without granting a purchase", async () => {
    const grantPurchase = vi.fn();
    const result = await handleStripeWebhook({
      payload: "{}",
      signature: "bad",
      webhookSecret: "whsec_test",
      constructEvent: () => {
        throw new Error("No signatures found matching the expected signature");
      },
      grantPurchase,
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "Invalid signature" });
    expect(grantPurchase).not.toHaveBeenCalled();
  });

  it("grants a purchase only after signature verification", async () => {
    const grantPurchase = vi.fn().mockResolvedValue("inserted");
    const result = await handleStripeWebhook({
      payload: "{}",
      signature: "good",
      webhookSecret: "whsec_test",
      constructEvent: () => completedEvent as never,
      grantPurchase,
    });

    expect(result.status).toBe(200);
    expect(grantPurchase).toHaveBeenCalledWith("user-1", "travel");
    expect(result.body).toEqual({ received: true });
  });

  it("treats duplicate webhook deliveries as successful (idempotent)", async () => {
    const grantPurchase = vi
      .fn()
      .mockResolvedValueOnce("inserted")
      .mockResolvedValueOnce("duplicate");

    const first = await handleStripeWebhook({
      payload: "{}",
      signature: "good",
      webhookSecret: "whsec_test",
      constructEvent: () => completedEvent as never,
      grantPurchase,
    });
    const second = await handleStripeWebhook({
      payload: "{}",
      signature: "good",
      webhookSecret: "whsec_test",
      constructEvent: () => completedEvent as never,
      grantPurchase,
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(grantPurchase).toHaveBeenCalledTimes(2);
  });

  it("does not grant purchases for unrelated event types", async () => {
    const grantPurchase = vi.fn();
    const result = await handleStripeWebhook({
      payload: "{}",
      signature: "good",
      webhookSecret: "whsec_test",
      constructEvent: () => ({ type: "ping", data: { object: {} } }) as never,
      grantPurchase,
    });

    expect(result.status).toBe(200);
    expect(grantPurchase).not.toHaveBeenCalled();
  });
});
