export type StripeLikeEvent = {
  type: string;
  data: {
    object: {
      id?: string;
      metadata?: Record<string, string> | null;
      payment_status?: string;
      payment_intent?: string | { id: string } | null;
      refunded?: boolean;
    };
  };
};

export type WebhookResult = {
  status: number;
  body: { received?: true; error?: string };
};

const GRANT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

function readPaymentIntentId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "string" &&
    (value as { id: string }).id.length > 0
  ) {
    return (value as { id: string }).id;
  }
  return null;
}

export async function handleStripeWebhook(input: {
  payload: string;
  signature: string;
  webhookSecret: string;
  constructEvent: (
    payload: string,
    signature: string,
    secret: string,
  ) => StripeLikeEvent;
  grantPurchase: (
    userId: string,
    packId: string,
    paymentIntentId: string | null,
  ) => Promise<"inserted" | "duplicate">;
  revokePurchase?: (
    paymentIntentId: string,
  ) => Promise<"revoked" | "not_found">;
}): Promise<WebhookResult> {
  let event: StripeLikeEvent;
  try {
    event = input.constructEvent(
      input.payload,
      input.signature,
      input.webhookSecret,
    );
  } catch {
    return { status: 400, body: { error: "Invalid signature" } };
  }

  if (event.type === "charge.refunded") {
    const paymentIntentId = readPaymentIntentId(
      event.data.object.payment_intent,
    );
    if (paymentIntentId && input.revokePurchase) {
      await input.revokePurchase(paymentIntentId);
    }
    return { status: 200, body: { received: true } };
  }

  if (!GRANT_EVENTS.has(event.type)) {
    return { status: 200, body: { received: true } };
  }

  if (event.data.object.payment_status !== "paid") {
    return { status: 200, body: { received: true } };
  }

  const userId = event.data.object.metadata?.supabase_user_id;
  const packId = event.data.object.metadata?.pack_id;
  if (!userId || !packId) {
    return { status: 400, body: { error: "Missing purchase metadata" } };
  }

  await input.grantPurchase(
    userId,
    packId,
    readPaymentIntentId(event.data.object.payment_intent),
  );
  return { status: 200, body: { received: true } };
}
