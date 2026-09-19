import { describe, expect, it, vi } from "vitest";
import { handleStripeWebhook } from "@/lib/billing/stripe-webhook";

const completedEvent = {
  type: "checkout.session.completed",
  data: {
    object: {
      payment_status: "paid",
      payment_intent: "pi_paid",
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
    expect(grantPurchase).toHaveBeenCalledWith("user-1", "travel", "pi_paid");
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

  it("does not grant a purchase when checkout completes unpaid", async () => {
    const grantPurchase = vi.fn();
    const revokePurchase = vi.fn();
    const result = await handleStripeWebhook({
      payload: "{}",
      signature: "good",
      webhookSecret: "whsec_test",
      constructEvent: () =>
        ({
          type: "checkout.session.completed",
          data: {
            object: {
              payment_status: "unpaid",
              payment_intent: "pi_unpaid",
              metadata: {
                supabase_user_id: "user-1",
                pack_id: "travel",
              },
            },
          },
        }) as never,
      grantPurchase,
      revokePurchase,
    });

    expect(result.status).toBe(200);
    expect(grantPurchase).not.toHaveBeenCalled();
    expect(revokePurchase).not.toHaveBeenCalled();
  });

  it("grants a purchase on async_payment_succeeded when paid", async () => {
    const grantPurchase = vi.fn().mockResolvedValue("inserted");
    const result = await handleStripeWebhook({
      payload: "{}",
      signature: "good",
      webhookSecret: "whsec_test",
      constructEvent: () =>
        ({
          type: "checkout.session.async_payment_succeeded",
          data: {
            object: {
              payment_status: "paid",
              payment_intent: "pi_async",
              metadata: {
                supabase_user_id: "user-1",
                pack_id: "travel",
              },
            },
          },
        }) as never,
      grantPurchase,
    });

    expect(result.status).toBe(200);
    expect(grantPurchase).toHaveBeenCalledWith("user-1", "travel", "pi_async");
  });

  it("revokes access when a charge is refunded", async () => {
    const grantPurchase = vi.fn();
    const revokePurchase = vi.fn().mockResolvedValue("revoked");
    const result = await handleStripeWebhook({
      payload: "{}",
      signature: "good",
      webhookSecret: "whsec_test",
      constructEvent: () =>
        ({
          type: "charge.refunded",
          data: {
            object: {
              id: "ch_1",
              payment_intent: "pi_refund",
              refunded: true,
            },
          },
        }) as never,
      grantPurchase,
      revokePurchase,
    });

    expect(result.status).toBe(200);
    expect(grantPurchase).not.toHaveBeenCalled();
    expect(revokePurchase).toHaveBeenCalledWith("pi_refund");
  });
});
