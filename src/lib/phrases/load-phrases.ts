import { PhraseRecordSchema, type PhraseRecord } from "@/lib/validation/translation-schema";
import { resolvePhraseAccess } from "@/lib/phrases/access";

export type PhraseRequestLoader = {
  getUser: () => Promise<{ id: string } | null>;
  getPack: (
    packId: string,
  ) => Promise<{ id: string; is_free: boolean } | null>;
  hasPurchase: (userId: string, packId: string) => Promise<boolean>;
  getPhrases: (packId: string) => Promise<unknown[]>;
};

export type PhrasesResponse =
  | { status: 200; body: { phrases: PhraseRecord[] } }
  | { status: 401 | 403 | 404 | 500; body: { error: string } };

export async function loadPhrasesForRequest(
  packId: string,
  loader: PhraseRequestLoader,
): Promise<PhrasesResponse> {
  const user = await loader.getUser();
  const pack = user ? await loader.getPack(packId) : null;
  const hasPurchase =
    user && pack && !pack.is_free
      ? await loader.hasPurchase(user.id, packId)
      : false;

  const access = resolvePhraseAccess({
    userId: user?.id ?? null,
    pack,
    hasPurchase,
  });

  if (!access.ok) {
    return { status: access.status, body: { error: access.error } };
  }

  const rows = await loader.getPhrases(packId);
  const parsed = PhraseRecordSchema.array().safeParse(rows);
  if (!parsed.success) {
    console.error("Phrase payload failed Zod validation");
    return { status: 500, body: { error: "Invalid phrase data" } };
  }

  return { status: 200, body: { phrases: parsed.data } };
}
