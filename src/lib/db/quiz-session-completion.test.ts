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

describe("Issue #15: quiz_answers and session completion", () => {
  const sql = latestSubmitAnswerSql();
  const migration = readFileSync(
    join(migrationsDir, "011_quiz_session_completion.sql"),
    "utf8",
  );

  it("creates quiz_answers with unique session/phrase and no client policies", () => {
    expect(migration).toMatch(
      /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.quiz_answers/i,
    );
    expect(migration).toMatch(
      /constraint\s+quiz_answers_session_id_phrase_id_key\s+unique\s*\(\s*session_id\s*,\s*phrase_id\s*\)/i,
    );
    expect(migration).toMatch(
      /create\s+index\s+if\s+not\s+exists\s+idx_quiz_answers_session_id/i,
    );
    expect(migration).toMatch(
      /phrase_id uuid references public\.phrases\(id\) on delete restrict/i,
    );
    expect(migration).toMatch(
      /alter\s+table\s+public\.quiz_answers\s+enable\s+row\s+level\s+security/i,
    );
    expect(migration).not.toMatch(/create\s+policy[\s\S]*quiz_answers/i);
    expect(migration).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.quiz_answers\s+from\s+authenticated/i,
    );
  });

  it("records a grade after a valid choice, including correct answers", () => {
    expect(sql).toMatch(
      /v_is_correct\s*:=\s*\(selected_choice_text\s*=\s*v_correct_text\)/i,
    );
    expect(sql).toMatch(
      /insert\s+into\s+public\.quiz_answers\s*\(\s*session_id\s*,\s*phrase_id\s*,\s*is_correct\s*\)/i,
    );
    expect(sql).toMatch(
      /on conflict\s*\(\s*session_id\s*,\s*phrase_id\s*\)\s+do nothing/i,
    );
  });

  it("does not insert quiz_answers on Invalid choice", () => {
    const invalidAt = sql.search(/raise exception 'Invalid choice'/i);
    const insertAt = sql.search(/insert\s+into\s+public\.quiz_answers/i);
    expect(invalidAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(invalidAt);
  });

  it("marks completed_at only when answers match the assigned question count", () => {
    expect(sql).toMatch(
      /count\s*\(\s*distinct\s+phrase_id\s*\)\s+into\s+v_answer_count/i,
    );
    expect(sql).toMatch(
      /from\s+public\.quiz_answers[\s\S]*session_id\s*=\s*session_id_param/i,
    );
    expect(sql).toMatch(
      /from\s+public\.quiz_session_questions[\s\S]*session_id\s*=\s*session_id_param/i,
    );
    expect(sql).toMatch(
      /v_assigned_count\s*>\s*0\s+and\s+v_answer_count\s*=\s*v_assigned_count/i,
    );
    expect(sql).toMatch(
      /update\s+public\.quiz_sessions[\s\S]*completed_at\s*=\s*timezone\('utc'::text,\s*now\(\)\)[\s\S]*completed_at\s+is\s+null/i,
    );
    expect(sql).not.toMatch(
      /v_answer_count\s*=\s*5|v_assigned_count\s*=\s*5|limit\s+5[\s\S]*completed_at/i,
    );
  });

  it("leaves consume_heart duplicate protection unchanged", () => {
    const consumeSql = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
      .join("\n");
    expect(consumeSql).toMatch(
      /on conflict \(session_id, phrase_id\) do nothing/i,
    );
    expect(consumeSql).toMatch(/returning id into v_attempt_id/i);
    expect(sql).not.toMatch(/consume_heart/i);
  });
});
