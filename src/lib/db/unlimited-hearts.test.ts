import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/015_unlimited_hearts.sql",
);

describe("unlimited hearts product", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const startSql =
    sql.match(
      /create\s+or\s+replace\s+function\s+public\.create_quiz_session[\s\S]*?language\s+plpgsql[^;]*;/i,
    )?.[0] ?? "";

  it("stores the unlimited hearts offer outside content packs", () => {
    expect(sql).toMatch(/create\s+table\s+public\.billing_products/i);
    expect(sql).toMatch(/create\s+table\s+public\.user_unlimited_hearts/i);
    expect(sql).toMatch(/'unlimited_hearts',\s*1\.99/);
    expect(sql).toMatch(/on\s+delete\s+set\s+null/i);
    expect(sql).toMatch(/stripe_payment_intent_id/);
    expect(sql).not.toMatch(/insert\s+into\s+public\.content_packs/i);
    expect(sql.match(/create policy[\s\S]*?\bfor insert\b/gi)).toBeNull();
  });

  it("checks pack purchase before the unlimited hearts bypass", () => {
    const packDenied = startSql.indexOf("Purchased pack permission required");
    const unlimited = startSql.indexOf("user_unlimited_hearts");
    expect(packDenied).toBeGreaterThan(-1);
    expect(unlimited).toBeGreaterThan(packDenied);
  });

  it("skips the zero-heart refusal and the one-heart decrement when unlimited", () => {
    const unlimitedChecks = startSql.match(/if\s+not\s+v_unlimited\s+then/gi);
    expect(unlimitedChecks).toHaveLength(2);
    const noHearts = startSql.indexOf("No hearts remaining");
    const firstBypass = startSql.search(/if\s+not\s+v_unlimited\s+then/i);
    const insertSession = startSql.search(/insert\s+into\s+public\.quiz_sessions/i);
    const updateHearts = startSql.search(
      /update\s+public\.profiles[\s\S]*hearts\s*=\s*v_calc_hearts\s*-\s*1/i,
    );
    expect(firstBypass).toBeGreaterThan(-1);
    expect(firstBypass).toBeLessThan(noHearts);
    expect(noHearts).toBeLessThan(insertSession);
    expect(updateHearts).toBeGreaterThan(insertSession);
    expect(startSql).toMatch(/Rate limit exceeded/);
  });

  it("exports unlimited hearts rows for the signed-in user", () => {
    expect(sql).toMatch(/'unlimited_hearts'/);
    expect(sql).toMatch(/from\s+public\.user_unlimited_hearts/i);
    expect(sql).toMatch(/where\s+uh\.user_id\s*=\s*v_user_id/i);
  });
});
