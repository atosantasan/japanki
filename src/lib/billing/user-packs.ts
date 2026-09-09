export type PurchasePackRow = {
  pack_id: string;
};

type UserPacksClient = {
  from: (table: string) => {
    select: (columns: string) => PromiseLike<{
      data: PurchasePackRow[] | null;
      error: { message?: string } | null;
    }>;
  };
};

export async function fetchUserPacks(
  supabase: UserPacksClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_purchases")
    .select("pack_id");

  if (error || !data) {
    if (error) {
      console.error("fetchUserPacks failed:", error);
    }
    return [];
  }

  return data
    .map((row) => row.pack_id)
    .filter((packId): packId is string => typeof packId === "string" && packId.length > 0);
}

export function isPackOwned(
  ownedPackIds: readonly string[],
  packId: string,
): boolean {
  return ownedPackIds.includes(packId);
}
