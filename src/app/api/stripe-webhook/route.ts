import { NextResponse } from "next/server";
import { grantPurchase } from "@/lib/billing/grant-purchase";
import { revokePurchaseByPaymentIntent } from "@/lib/billing/revoke-purchase";
import { handleStripeWebhook } from "@/lib/billing/stripe-webhook";
import { getStripe, getStripeWebhookSecret } from "@/lib/billing/stripe";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const stripe = getStripe();
  const admin = createAdminSupabaseClient();

  const result = await handleStripeWebhook({
    payload,
    signature,
    webhookSecret: getStripeWebhookSecret(),
    constructEvent: (body, sig, secret) =>
      stripe.webhooks.constructEvent(body, sig, secret) as never,
    grantPurchase: (userId, packId, paymentIntentId) =>
      grantPurchase(admin as never, userId, packId, paymentIntentId),
    revokePurchase: (paymentIntentId) =>
      revokePurchaseByPaymentIntent(admin as never, paymentIntentId),
  });

  if (result.status >= 400) {
    console.error("Stripe webhook rejected", result.body);
  }

  return NextResponse.json(result.body, { status: result.status });
}
