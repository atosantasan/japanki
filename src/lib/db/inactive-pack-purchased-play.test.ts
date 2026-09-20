import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations",
);

function latestCreateQuizSessionSql(): string {
  const allSql = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
    .join("\n");
  const matches = [
    ...allSql.matchAll(
      /create\s+or\s+replace\s+function\s+public\.create_quiz_session[\s\S]*?language\s+plpgsql[^;]*;/gi,
    ),
  ];
  return matches.at(-1)?.[0] ?? "";
}

describe("Issue #42: inactive paid packs stay playable for purchasers", () => {
  const sql = latestCreateQuizSessionSql();

  it("loads packs without requiring is_active = true", () => {
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.create_quiz_session/i);
    expect(sql).toMatch(/v_user_id uuid := auth\.uid\(\)/);
    expect(sql).toMatch(
      /select\s+is_free\s*,\s*is_active\s+into\s+v_is_free\s*,\s+v_is_active/i,
    );
    expect(sql).toMatch(/from\s+public\.content_packs\s+where\s+id\s*=\s*pack_id_param;/i);
    expect(sql).not.toMatch(
      /from\s+public\.content_packs\s+where\s+id\s*=\s*pack_id_param\s+and\s+is_active/i,
    );
  });

  it("keeps inactive free packs as not found", () => {
    expect(sql).toMatch(
      /if\s+not\s+v_is_active then[\s\S]*?if\s+v_is_free then[\s\S]*?Content pack not found/i,
    );
  });

  it("allows inactive paid packs only when user_purchases has this user", () => {
    expect(sql).toMatch(
      /if\s+not\s+v_is_active then[\s\S]*?user_purchases[\s\S]*?user_id = v_user_id[\s\S]*?pack_id = pack_id_param[\s\S]*?if not v_has_purchased then[\s\S]*?Content pack not found/i,
    );
  });

  it("still requires a purchase for active paid packs", () => {
    expect(sql).toMatch(/Purchased pack permission required/);
  });
});
