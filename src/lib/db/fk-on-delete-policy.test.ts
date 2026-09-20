import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations",
);

const migrationFile = "005_fk_on_delete_policy.sql";
const migrationPath = join(migrationsDir, migrationFile);

const TARGET_FKS = [
  {
    table: "phrases",
    column: "pack_id",
    constraint: "phrases_pack_id_fkey",
    referencedTable: "content_packs",
  },
  {
    table: "quiz_sessions",
    column: "pack_id",
    constraint: "quiz_sessions_pack_id_fkey",
    referencedTable: "content_packs",
  },
  {
    table: "user_purchases",
    column: "pack_id",
    constraint: "user_purchases_pack_id_fkey",
    referencedTable: "content_packs",
  },
  {
    table: "quiz_session_questions",
    column: "phrase_id",
    constraint: "quiz_session_questions_phrase_id_fkey",
    referencedTable: "phrases",
  },
  {
    table: "quiz_attempts",
    column: "phrase_id",
    constraint: "quiz_attempts_phrase_id_fkey",
    referencedTable: "phrases",
  },
] as const;

describe("Issue #25: FK ON DELETE RESTRICT policy", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("is present among numbered migrations", () => {
    expect(readdirSync(migrationsDir)).toContain(migrationFile);
  });

  it("references Issue #25 in the migration header", () => {
    expect(sql).toMatch(/Issue\s*#25/i);
  });

  it("defers content_packs.is_active to a follow-up issue via TODO", () => {
    expect(sql).toMatch(/TODO[\s\S]{0,400}is_active/i);
    expect(sql).not.toMatch(
      /add\s+column(?:\s+if\s+not\s+exists)?\s+is_active/i,
    );
  });

  it.each(TARGET_FKS)(
    "replaces $constraint with ON DELETE RESTRICT",
    ({ table, column, constraint, referencedTable }) => {
      const dropAndAdd = new RegExp(
        [
          `alter\\s+table\\s+public\\.${table}`,
          `[\\s\\S]*?drop\\s+constraint\\s+${constraint}`,
          `[\\s\\S]*?add\\s+constraint\\s+${constraint}`,
          `[\\s\\S]*?foreign\\s+key\\s*\\(\\s*${column}\\s*\\)`,
          `[\\s\\S]*?references\\s+public\\.${referencedTable}\\s*\\(\\s*id\\s*\\)`,
          `[\\s\\S]*?on\\s+delete\\s+restrict`,
        ].join(""),
        "i",
      );

      expect(sql).toMatch(dropAndAdd);
    },
  );
});
