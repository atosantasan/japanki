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

export async function revokePurchaseByPaymentIntent(
  admin: DeleteClient,
  paymentIntentId: string,
): Promise<RevokePurchaseResult> {
  const { data, error } = await admin
    .from("user_purchases")
    .delete()
    .eq("stripe_payment_intent_id", paymentIntentId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return data && data.length > 0 ? "revoked" : "not_found";
}
