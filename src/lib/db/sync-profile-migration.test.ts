import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations/002_sync_profile.sql",
);

describe("Issue #013: sync_profile SQL ambiguous id and parameter naming", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("contains #variable_conflict use_column directive to avoid PL/pgSQL variable ambiguity (code 42702)", () => {
    expect(sql).toMatch(/#variable_conflict\s+use_column/i);
  });

  it("uses p_ prefix for function parameters and v_ prefix for local variables", () => {
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.sync_profile\s*\(\s*p_preferred_language/i);
    expect(sql).toMatch(/v_user_id\s+uuid/i);
    expect(sql).toMatch(/v_is_anonymous\s+boolean/i);
    expect(sql).toMatch(/v_language\s+text/i);
  });

  it("qualifies all column references with table aliases (p., ai.) to eliminate ambiguity", () => {
    // Check for explicit aliases on profiles and identities
    expect(sql).toMatch(/auth\.identities\s+as\s+ai/i);
    expect(sql).toMatch(/ai\.user_id\s*=\s*v_user_id/i);
    expect(sql).toMatch(/ai\.provider\s*<>\s*'anonymous'/i);
    expect(sql).toMatch(/public\.profiles\s+as\s+p/i);
    expect(sql).toMatch(/p\.id\s*=\s*v_user_id/i);
  });

  it("uses constraint-based or fully disambiguated conflict resolution on profiles_pkey", () => {
    expect(sql).toMatch(/on\s+conflict\s+on\s+constraint\s+profiles_pkey/i);
  });
});
