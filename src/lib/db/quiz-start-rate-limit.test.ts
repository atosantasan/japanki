import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { QUIZ_START_RATE_LIMIT_PER_HOUR } from "@/lib/constants/app";

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

describe("Issue #17: create_quiz_session hourly rate limit", () => {
  const sql = latestCreateQuizSessionSql();
  const migration = readFileSync(
    join(migrationsDir, "009_quiz_start_rate_limit.sql"),
    "utf8",
  );

  it("indexes quiz_sessions by user_id and created_at for hourly counts", () => {
    expect(migration).toMatch(
      /create\s+index\s+if\s+not\s+exists\s+idx_quiz_sessions_user_id_created_at/i,
    );
    expect(migration).toMatch(
      /on\s+public\.quiz_sessions\s*\(\s*user_id\s*,\s*created_at\s*\)/i,
    );
  });

  it("rejects a 21st create_quiz_session in the same hour", () => {
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.create_quiz_session/i);
    expect(sql).toMatch(
      /from\s+public\.quiz_sessions[\s\S]*user_id\s*=\s*v_user_id[\s\S]*created_at\s*>\s*now\(\)\s*-\s*interval\s+'1 hour'/i,
    );
    expect(sql).toMatch(
      new RegExp(
        `v_recent_starts\\s*>=\\s*${QUIZ_START_RATE_LIMIT_PER_HOUR}[\\s\\S]*Rate limit exceeded`,
        "i",
      ),
    );
  });

  it("counts existing sessions instead of adding a dedicated counter table", () => {
    expect(migration).not.toMatch(/create\s+table/i);
  });
});
