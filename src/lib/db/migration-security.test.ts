import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/001_init.sql",
);

describe("Supabase init migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("defines create_quiz_session and consume_heart RPCs with auth.uid()", () => {
    expect(sql).toMatch(/create or replace function public\.create_quiz_session/i);
    expect(sql).toMatch(/create or replace function public\.consume_heart/i);
    expect(sql).toMatch(/v_user_id uuid := auth\.uid\(\)/);
  });

  it("verifies quiz session ownership and phrase assignment in consume_heart", () => {
    expect(sql).toMatch(/Unauthorized session access/);
    expect(sql).toMatch(/Phrase not assigned to this session/);
    expect(sql).toMatch(/user_id = auth\.uid\(\)/);
  });

  it("uses INSERT ON CONFLICT DO NOTHING RETURNING id for duplicate heart protection", () => {
    expect(sql).toMatch(
      /on conflict \(session_id, phrase_id\) do nothing/i,
    );
    expect(sql).toMatch(/returning id into v_attempt_id/i);
  });

  it("does not grant client INSERT policies on quiz tables", () => {
    const insertPolicies = sql.match(
      /create policy[\s\S]*?\bfor insert\b/gi,
    );
    expect(insertPolicies).toBeNull();
  });

  it("keeps later migrations free of client INSERT policies", () => {
    const migrationsDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../supabase/migrations",
    );
    for (const file of readdirSync(migrationsDir)) {
      const contents = readFileSync(join(migrationsDir, file), "utf8");
      expect(contents.match(/create policy[\s\S]*?\bfor insert\b/gi)).toBeNull();
    }
  });

  it("enables RLS on all public tables", () => {
    const tables = [
      "profiles",
      "content_packs",
      "phrases",
      "quiz_sessions",
      "quiz_session_questions",
      "quiz_attempts",
      "user_purchases",
    ];

    for (const table of tables) {
      expect(sql).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("restricts paid phrases from client select and scopes purchases to auth.uid()", () => {
    expect(sql).toMatch(/is_free = true/);
    expect(sql).toMatch(
      /create policy "ユーザーは自身の購入履歴のみ閲覧可能"/,
    );
    expect(sql).toMatch(
      /create policy "ユーザーは自身のプロフィールのみ閲覧可能"/,
    );
  });
});
