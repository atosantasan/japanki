import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SUBMIT_ANSWER_RATE_LIMIT_PER_HOUR } from "@/lib/constants/app";

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

describe("Issue #17: submit_answer hourly rate limit", () => {
  const sql = latestSubmitAnswerSql();
  const migration = readFileSync(
    join(migrationsDir, "010_submit_answer_rate_limit.sql"),
    "utf8",
  );

  it("creates submit_answer_calls with a user_id/called_at index and no client policies", () => {
    expect(migration).toMatch(/create\s+table(?:\s+if\s+not\s+exists)?\s+public\.submit_answer_calls/i);
    expect(migration).toMatch(
      /create\s+index\s+if\s+not\s+exists\s+idx_submit_answer_calls_user_id_called_at/i,
    );
    expect(migration).toMatch(
      /on\s+public\.submit_answer_calls\s*\(\s*user_id\s*,\s*called_at\s*\)/i,
    );
    expect(migration).toMatch(
      /alter\s+table\s+public\.submit_answer_calls\s+enable\s+row\s+level\s+security/i,
    );
    expect(migration).not.toMatch(
      /create\s+policy[\s\S]*submit_answer_calls/i,
    );
    expect(migration).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.submit_answer_calls\s+from\s+authenticated/i,
    );
  });

  it("rejects a 61st submit_answer in the same hour even without the BFF", () => {
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.submit_answer/i);
    expect(sql).toMatch(/v_user_id uuid := auth\.uid\(\)/);
    expect(sql).toMatch(
      /from\s+public\.submit_answer_calls[\s\S]*user_id\s*=\s*v_user_id[\s\S]*called_at\s*>\s*now\(\)\s*-\s*interval\s+'1 hour'/i,
    );
    expect(sql).toMatch(
      new RegExp(
        `v_recent_calls\\s*>=\\s*${SUBMIT_ANSWER_RATE_LIMIT_PER_HOUR}[\\s\\S]*Rate limit exceeded`,
        "i",
      ),
    );
  });

  it("inserts a submit_answer_calls row after grading, regardless of correctness", () => {
    expect(sql).toMatch(
      /if\s+not\s+v_is_correct then[\s\S]*consume_heart[\s\S]*else[\s\S]*from\s+public\.profiles[\s\S]*end if;[\s\S]*insert\s+into\s+public\.submit_answer_calls\s*\(\s*user_id\s*,\s*called_at\s*\)/i,
    );
    expect(sql).toMatch(
      /insert\s+into\s+public\.submit_answer_calls[\s\S]*return query/i,
    );
    const insertCount = sql.match(/insert\s+into\s+public\.submit_answer_calls/gi) ?? [];
    expect(insertCount).toHaveLength(1);
  });
});
