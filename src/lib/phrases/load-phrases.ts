import {
  PublicPhraseRecordSchema,
  type PublicPhraseRecord,
} from "@/lib/validation/translation-schema";
import {
  resolvePhraseAccess,
  type ContentPackAccess,
} from "@/lib/phrases/access";

export type PhraseRequestLoader = {
  getUser: () => Promise<{ id: string } | null>;
  getPack: (packId: string) => Promise<ContentPackAccess | null>;
  hasPurchase: (userId: string, packId: string) => Promise<boolean>;
  getPhrases: (packId: string) => Promise<unknown[]>;
};

export type PhrasesResponse =
  | { status: 200; body: { phrases: PublicPhraseRecord[] } }
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
  const parsed = PublicPhraseRecordSchema.array().safeParse(rows);
  if (!parsed.success) {
    console.error("Phrase payload failed Zod validation");
    return { status: 500, body: { error: "Invalid phrase data" } };
  }

  return { status: 200, body: { phrases: parsed.data } };
}
