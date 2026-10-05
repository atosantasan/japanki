export type RevokePurchaseResult = "revoked" | "not_found";

type DeleteClient = {
  from: (table: string) => {
    delete: () => {
      eq: (
        column: string,
        value: string,
      ) => {
        select: (columns: string) => PromiseLike<{
          data: { id: string }[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

async function deleteByPaymentIntent(
  admin: DeleteClient,
  table: "user_purchases" | "user_unlimited_hearts",
  paymentIntentId: string,
): Promise<number> {
  const { data, error } = await admin
    .from(table)
    .delete()
    .eq("stripe_payment_intent_id", paymentIntentId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return data?.length ?? 0;
}

export async function revokePurchaseByPaymentIntent(
  admin: DeleteClient,
  paymentIntentId: string,
): Promise<RevokePurchaseResult> {
  const purchases = await deleteByPaymentIntent(
    admin,
    "user_purchases",
    paymentIntentId,
  );
  const unlimitedHearts = await deleteByPaymentIntent(
    admin,
    "user_unlimited_hearts",
    paymentIntentId,
  );

  return purchases + unlimitedHearts > 0 ? "revoked" : "not_found";
}
