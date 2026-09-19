import type { PublicPhraseRecord } from "@/lib/validation/translation-schema";

export type AssignedQuestion = {
  phrase_id: string;
  position: number;
};

export function buildQuizQueue(input: {
  packId: string;
  assigned: AssignedQuestion[];
  phrases: PublicPhraseRecord[];
}): PublicPhraseRecord[] {
  const uniqueIds = new Set(input.assigned.map((item) => item.phrase_id));
  if (input.assigned.length !== 5 || uniqueIds.size !== 5) {
    throw new Error("A session must contain exactly 5 unique phrases");
  }

  const byId = new Map(input.phrases.map((phrase) => [phrase.id, phrase]));
  const ordered = [...input.assigned].sort((a, b) => a.position - b.position);

  return ordered.map((item) => {
    const phrase = byId.get(item.phrase_id);
    if (!phrase) {
      throw new Error("Assigned phrase is missing from the pack payload");
    }
    if (phrase.pack_id !== input.packId) {
      throw new Error("Assigned phrase does not belong to the selected pack");
    }
    return phrase;
  });
}
