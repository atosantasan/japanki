import { describe, expect, it } from "vitest";
import { buildQuizQueue } from "@/lib/quiz/build-queue";
import type { PhraseRecord } from "@/lib/validation/translation-schema";

function phrase(id: string, packId: string): PhraseRecord {
  const translations = {
    en: id,
    "zh-TW": id,
    "zh-CN": id,
    ko: id,
    th: id,
    fr: id,
    de: id,
    es: id,
  };
  const choices = [id, `${id}-b`, `${id}-c`] as const;

  return {
    id,
    pack_id: packId,
    romaji: id,
    japanese: id,
    audio_url: `/audio/${id}.mp3`,
    translations,
    choices_by_lang: {
      en: [...choices],
      "zh-TW": [...choices],
      "zh-CN": [...choices],
      ko: [...choices],
      th: [...choices],
      fr: [...choices],
      de: [...choices],
      es: [...choices],
    },
    correct_choice_index: 0,
  };
}

describe("buildQuizQueue", () => {
  it("returns the five assigned phrases in position order without duplicates", () => {
    const phrases = [
      phrase("p1", "survival"),
      phrase("p2", "survival"),
      phrase("p3", "survival"),
      phrase("p4", "survival"),
      phrase("p5", "survival"),
      phrase("p6", "survival"),
    ];
    const assigned = [
      { phrase_id: "p5", position: 5 },
      { phrase_id: "p1", position: 1 },
      { phrase_id: "p3", position: 3 },
      { phrase_id: "p2", position: 2 },
      { phrase_id: "p4", position: 4 },
    ];

    const queue = buildQuizQueue({
      packId: "survival",
      assigned,
      phrases,
    });

    expect(queue.map((item) => item.id)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(new Set(queue.map((item) => item.id)).size).toBe(5);
  });

  it("rejects assigned phrases from another pack", () => {
    expect(() =>
      buildQuizQueue({
        packId: "survival",
        assigned: [
          { phrase_id: "p1", position: 1 },
          { phrase_id: "p2", position: 2 },
          { phrase_id: "p3", position: 3 },
          { phrase_id: "p4", position: 4 },
          { phrase_id: "p5", position: 5 },
        ],
        phrases: [
          phrase("p1", "survival"),
          phrase("p2", "travel"),
          phrase("p3", "survival"),
          phrase("p4", "survival"),
          phrase("p5", "survival"),
        ],
      }),
    ).toThrow(/selected pack/i);
  });
});
