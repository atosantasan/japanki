export type PurchaseGrantResult = "inserted" | "duplicate";

type InsertClient = {
  from: (table: string) => {
    insert: (
      row: Record<string, string>,
    ) => PromiseLike<{ error: { code?: string; message: string } | null }>;
  };
};

export async function grantPurchase(
  admin: InsertClient,
  userId: string,
  packId: string,
  paymentIntentId?: string | null,
): Promise<PurchaseGrantResult> {
  const row: Record<string, string> = {
    user_id: userId,
    pack_id: packId,
  };
  if (paymentIntentId) {
    row.stripe_payment_intent_id = paymentIntentId;
  }

  const { error } = await admin.from("user_purchases").insert(row);

  if (!error) {
    return "inserted";
  }

  if (error.code === "23505") {
    return "duplicate";
  }

  throw new Error(error.message);
}
