import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations",
);

function latestFunctionSql(functionName: string): string {
  const allSql = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
    .join("\n");
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}[\\s\\S]*?language\\s+plpgsql[^;]*;`,
    "gi",
  );
  const matches = [...allSql.matchAll(pattern)];
  return matches.at(-1)?.[0] ?? "";
}

describe("Issue #52: one heart per quiz start", () => {
  const startSql = latestFunctionSql("create_quiz_session");
  const gradeSql = latestFunctionSql("submit_answer");
  const consumeSql = latestFunctionSql("consume_heart");

  it("refuses to create a session when recovered hearts are 0", () => {
    const noHearts = startSql.indexOf("No hearts remaining");
    const insertSession = startSql.search(/insert\s+into\s+public\.quiz_sessions/i);
    expect(startSql).toMatch(/for\s+update/i);
    expect(startSql).toMatch(/least\s*\(\s*5\s*,/i);
    expect(noHearts).toBeGreaterThan(-1);
    expect(insertSession).toBeGreaterThan(noHearts);
  });

  it("deducts exactly one heart after five phrases are assigned", () => {
    const notEnough = startSql.indexOf("Not enough phrases in the selected pack");
    const updateHearts = startSql.search(
      /update\s+public\.profiles[\s\S]*hearts\s*=\s*v_calc_hearts\s*-\s*1/i,
    );
    expect(notEnough).toBeGreaterThan(-1);
    expect(updateHearts).toBeGreaterThan(notEnough);
    expect(startSql.match(/update\s+public\.profiles/gi)).toHaveLength(1);
  });

  it("does not spend a heart when grading an answer", () => {
    expect(gradeSql).not.toMatch(/consume_heart/i);
    const incorrectBranch =
      gradeSql.match(/if\s+not\s+v_is_correct\s+then([\s\S]*?)else/i)?.[1] ?? "";
    expect(incorrectBranch).toMatch(/from\s+public\.profiles/i);
    expect(incorrectBranch).not.toMatch(/update\s+public\.profiles/i);
    expect(incorrectBranch).not.toMatch(/hearts\s*=\s*v_hearts\s*-\s*1/i);
  });

  it("keeps direct consume_heart from decrementing hearts", () => {
    expect(consumeSql).toMatch(/v_user_id uuid := auth\.uid\(\)/);
    expect(consumeSql).toMatch(/Not authenticated/);
    expect(consumeSql).not.toMatch(/hearts\s*=\s*.*-\s*1/i);
    expect(consumeSql).not.toMatch(/update\s+public\.profiles/i);
    expect(consumeSql).not.toMatch(/insert\s+into\s+public\.quiz_attempts/i);
  });
});
