export type ContentPackAccess = {
  id: string;
  is_free: boolean;
};

export type PhraseAccessResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 404; error: string };

export function resolvePhraseAccess(input: {
  userId: string | null;
  pack: ContentPackAccess | null;
  hasPurchase: boolean;
}): PhraseAccessResult {
  if (!input.userId) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }

  if (!input.pack) {
    return { ok: false, status: 404, error: "Content pack not found" };
  }

  if (!input.pack.is_free && !input.hasPurchase) {
    return {
      ok: false,
      status: 403,
      error: "Purchased pack permission required",
    };
  }

  return { ok: true };
}
