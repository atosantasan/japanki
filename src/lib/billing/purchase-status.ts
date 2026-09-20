export type PurchaseStatusLoader = {
  getUser: () => Promise<{ id: string } | null>;
  hasPurchase: (userId: string, packId: string) => Promise<boolean>;
};

export type PurchaseStatusResponse =
  | { status: 200; body: { purchased: boolean } }
  | { status: 400 | 401; body: { error: string } };

export async function getPurchaseStatusForRequest(
  packId: string,
  loader: PurchaseStatusLoader,
): Promise<PurchaseStatusResponse> {
  const trimmed = packId.trim();
  if (!trimmed) {
    return { status: 400, body: { error: "pack_id is required" } };
  }

  const user = await loader.getUser();
  if (!user) {
    return { status: 401, body: { error: "unauthenticated" } };
  }

  const purchased = await loader.hasPurchase(user.id, trimmed);
  return { status: 200, body: { purchased } };
}
