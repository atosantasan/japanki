export type StripeLikeEvent = {
  type: string;
  data: {
    object: {
      metadata?: Record<string, string> | null;
    };
  };
};

export type WebhookResult = {
  status: number;
  body: { received?: true; error?: string };
};

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
  ) => Promise<"inserted" | "duplicate">;
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

  if (event.type !== "checkout.session.completed") {
    return { status: 200, body: { received: true } };
  }

  const userId = event.data.object.metadata?.supabase_user_id;
  const packId = event.data.object.metadata?.pack_id;
  if (!userId || !packId) {
    return { status: 400, body: { error: "Missing purchase metadata" } };
  }

  await input.grantPurchase(userId, packId);
  return { status: 200, body: { received: true } };
}
