import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations",
);

const migrationFile = "006_content_packs_price_and_active.sql";
const migrationPath = join(migrationsDir, migrationFile);

describe("Issue #24: content_packs.price_usd precision", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("widens price_usd to numeric(10,2) without rewriting existing values", () => {
    expect(sql).toMatch(/Issue\s*#24/i);
    expect(sql).toMatch(
      /alter\s+column\s+price_usd\s+type\s+numeric\s*\(\s*10\s*,\s*2\s*\)/i,
    );
    expect(sql).not.toMatch(
      /alter\s+column\s+price_usd[\s\S]{0,80}\busing\b/i,
    );
  });
});

describe("Issue #37: content_packs.is_active logical delete", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const allSql = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
    .join("\n");

  it("adds is_active boolean NOT NULL DEFAULT true", () => {
    expect(sql).toMatch(/Issue\s*#37/i);
    expect(sql).toMatch(
      /add\s+column(?:\s+if\s+not\s+exists)?\s+is_active\s+boolean\s+not\s+null\s+default\s+true/i,
    );
  });

  it("treats inactive packs as missing in create_quiz_session", () => {
    expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.create_quiz_session/i);
    expect(sql).toMatch(
      /from\s+public\.content_packs\s+where\s+id\s*=\s*pack_id_param\s+and\s+is_active\s*=\s*true/i,
    );
    expect(sql).toMatch(/raise\s+exception\s+'Content pack not found'/i);
  });

  it("restricts free phrase SELECT to active packs", () => {
    expect(sql).toMatch(
      /is_free\s*=\s*true\s+and\s+is_active\s*=\s*true/i,
    );
  });

  it("leaves seed Survival and Travel active via the column default", () => {
    expect(allSql).not.toMatch(
      /update\s+public\.content_packs[\s\S]{0,200}is_active\s*=\s*false/i,
    );
  });
});
