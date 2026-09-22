import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations",
);

function latestSubmitAnswerSql(): string {
  const allSql = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
    .join("\n");
  const matches = [
    ...allSql.matchAll(
      /create\s+or\s+replace\s+function\s+public\.submit_answer[\s\S]*?language\s+plpgsql[^;]*;/gi,
    ),
  ];
  return matches.at(-1)?.[0] ?? "";
}

describe("correct answers persist recovered hearts", () => {
  const sql = latestSubmitAnswerSql();

  it("recovers and persists hearts on a correct grade instead of returning the stored zero", () => {
    expect(sql).not.toMatch(/consume_heart/i);
    expect(sql).toMatch(/v_elapsed_minutes/);
    expect(sql).toMatch(/v_recovered_hearts/);
    expect(sql).toMatch(
      /update\s+public\.profiles[\s\S]*set\s+hearts\s*=\s*v_hearts[\s\S]*last_heart_updated_at\s*=\s*v_updated_at/i,
    );
    expect(sql).toMatch(
      /else[\s\S]*from\s+public\.profiles[\s\S]*for update/i,
    );
  });

  it("caps recovered hearts at 5 and never writes below 0", () => {
    expect(sql).toMatch(/least\s*\(\s*5\s*,/i);
    expect(sql).toMatch(/greatest\s*\(\s*0\s*,/i);
  });
});
