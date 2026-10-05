import type { PurchaseGrantResult } from "@/lib/billing/grant-purchase";

type InsertClient = {
  from: (table: string) => {
    insert: (
      row: Record<string, string>,
    ) => PromiseLike<{ error: { code?: string; message: string } | null }>;
  };
};

export async function grantUnlimitedHearts(
  admin: InsertClient,
  userId: string,
  paymentIntentId?: string | null,
): Promise<PurchaseGrantResult> {
  const row: Record<string, string> = {
    user_id: userId,
  };
  if (paymentIntentId) {
    row.stripe_payment_intent_id = paymentIntentId;
  }

  const { error } = await admin.from("user_unlimited_hearts").insert(row);

  if (!error) {
    return "inserted";
  }

  if (error.code === "23505") {
    return "duplicate";
  }

  throw new Error(error.message);
}
