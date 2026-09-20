import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTENT_LOCALES } from "@/lib/i18n/locales";
import { PhraseRecordSchema } from "@/lib/validation/translation-schema";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations",
);

const seedPath = join(migrationsDir, "003_seed_packs.sql");
const diversifyPath = join(
  migrationsDir,
  "007_diversify_seed_correct_index.sql",
);

const SEED_TUPLE_RE =
  /\(\s*'([0-9a-f-]+)',\s*'(\w+)',\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)'::jsonb,\s*'((?:[^']|'')+)'::jsonb,\s*(\d+),\s*(\d+)\s*\)/g;

const UPDATE_RE =
  /choices_by_lang = \$json\$(.*)\$json\$::jsonb,\s*correct_choice_index = (\d+)\s*where id = '([0-9a-f-]+)'/g;

function unescapeSql(value: string): string {
  return value.replaceAll("''", "'");
}

type SeedPhrase = {
  id: string;
  pack_id: string;
  romaji: string;
  japanese: string;
  audio_url: string;
  translations: Record<string, string>;
  choices_by_lang: Record<string, [string, string, string]>;
  correct_choice_index: number;
  sort_order: number;
};

function loadSeedPhrases(): SeedPhrase[] {
  const seedSql = readFileSync(seedPath, "utf8");
  const phrases = new Map<string, SeedPhrase>();

  for (const match of seedSql.matchAll(SEED_TUPLE_RE)) {
    const [
      ,
      id,
      packId,
      romaji,
      japanese,
      audioUrl,
      translationsRaw,
      choicesRaw,
      index,
      sortOrder,
    ] = match;
    if (!id || !packId || !romaji || !japanese || !audioUrl) {
      throw new Error("Failed to parse seed phrase tuple");
    }
    phrases.set(id, {
      id,
      pack_id: packId,
      romaji: unescapeSql(romaji),
      japanese: unescapeSql(japanese),
      audio_url: unescapeSql(audioUrl),
      translations: JSON.parse(unescapeSql(translationsRaw ?? "{}")) as Record<
        string,
        string
      >,
      choices_by_lang: JSON.parse(unescapeSql(choicesRaw ?? "{}")) as Record<
        string,
        [string, string, string]
      >,
      correct_choice_index: Number(index),
      sort_order: Number(sortOrder),
    });
  }

  const diversifySql = readFileSync(diversifyPath, "utf8");
  for (const match of diversifySql.matchAll(UPDATE_RE)) {
    const [, choicesRaw, index, id] = match;
    const current = id ? phrases.get(id) : undefined;
    if (!current || !choicesRaw) {
      throw new Error(`Missing seed phrase for update ${id ?? "?"}`);
    }
    current.choices_by_lang = JSON.parse(choicesRaw) as Record<
      string,
      [string, string, string]
    >;
    current.correct_choice_index = Number(index);
  }

  return [...phrases.values()].sort(
    (left, right) =>
      left.pack_id.localeCompare(right.pack_id) ||
      left.sort_order - right.sort_order,
  );
}

describe("Issue #16: diversified seed correct_choice_index", () => {
  const phrases = loadSeedPhrases();

  it("references Issue #16 and does not rewrite 003_seed_packs.sql", () => {
    const sql = readFileSync(diversifyPath, "utf8");
    expect(sql).toMatch(/Issue\s*#16/i);
    expect(readFileSync(seedPath, "utf8")).toMatch(
      /correct_choice_index, sort_order/,
    );
  });

  it("spreads each pack across indexes 0, 1, and 2", () => {
    const packs = ["survival", "travel"] as const;
    for (const packId of packs) {
      const indexes = phrases
        .filter((phrase) => phrase.pack_id === packId)
        .map((phrase) => phrase.correct_choice_index);
      expect(indexes).toHaveLength(5);
      expect(new Set(indexes)).toEqual(new Set([0, 1, 2]));
      expect(indexes.every((index) => index === 0)).toBe(false);
    }
  });

  it("keeps PhraseRecordSchema and translation-aligned choices for all 8 locales", () => {
    expect(phrases).toHaveLength(10);

    for (const phrase of phrases) {
      const parsed = PhraseRecordSchema.parse(phrase);
      expect(Object.keys(parsed.choices_by_lang)).toEqual([...CONTENT_LOCALES]);

      for (const locale of CONTENT_LOCALES) {
        const choices = parsed.choices_by_lang[locale];
        expect(choices).toHaveLength(3);
        expect(choices[parsed.correct_choice_index]).toBe(
          parsed.translations[locale],
        );
      }
    }
  });

  it("makes a naive always-index-0 grader fail on at least one phrase per pack", () => {
    for (const packId of ["survival", "travel"] as const) {
      const packPhrases = phrases.filter((phrase) => phrase.pack_id === packId);
      const naiveHits = packPhrases.filter((phrase) => {
        const enChoices = phrase.choices_by_lang.en;
        return enChoices[0] === phrase.translations.en;
      });
      expect(naiveHits.length).toBeLessThan(packPhrases.length);
    }
  });
});
