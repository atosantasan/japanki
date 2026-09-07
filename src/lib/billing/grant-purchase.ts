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
): Promise<PurchaseGrantResult> {
  const { error } = await admin.from("user_purchases").insert({
    user_id: userId,
    pack_id: packId,
  });

  if (!error) {
    return "inserted";
  }

  if (error.code === "23505") {
    return "duplicate";
  }

  throw new Error(error.message);
}
