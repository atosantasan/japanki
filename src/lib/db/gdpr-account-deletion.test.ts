import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../supabase/migrations",
);

const migrationFile = "012_gdpr_account_deletion.sql";
const migrationPath = join(migrationsDir, migrationFile);

describe("Issue #20: GDPR account deletion and export_my_data", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("is present among numbered migrations", () => {
    expect(readdirSync(migrationsDir)).toContain(migrationFile);
  });

  it("references Issue #20 in the migration header", () => {
    expect(sql).toMatch(/Issue\s*#20/i);
  });

  it("makes user_purchases.user_id nullable with ON DELETE SET NULL", () => {
    expect(sql).toMatch(
      /alter\s+table\s+public\.user_purchases[\s\S]*?alter\s+column\s+user_id\s+drop\s+not\s+null/i,
    );
    expect(sql).toMatch(
      /drop\s+constraint\s+user_purchases_user_id_fkey/i,
    );
    expect(sql).toMatch(
      /add\s+constraint\s+user_purchases_user_id_fkey[\s\S]*?foreign\s+key\s*\(\s*user_id\s*\)[\s\S]*?references\s+public\.profiles\s*\(\s*id\s*\)[\s\S]*?on\s+delete\s+set\s+null/i,
    );
  });

  it("keeps stripe_payment_intent_id and does not hash purchase rows", () => {
    expect(sql).not.toMatch(/stripe_payment_intent_id\s*=/i);
    expect(sql).not.toMatch(/digest\s*\(|md5\s*\(|sha256/i);
  });

  it("defines export_my_data as SECURITY DEFINER scoped to auth.uid()", () => {
    expect(sql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.export_my_data\s*\(\s*\)/i,
    );
    expect(sql).toMatch(/v_user_id uuid := auth\.uid\(\)/);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/Not authenticated/);
    expect(sql).not.toMatch(
      /create\s+or\s+replace\s+function\s+public\.export_my_data\s*\(\s*\w+/i,
    );
  });

  it("exports profile, purchases, and quiz rows without rate-limit logs or content master", () => {
    expect(sql).toMatch(/from\s+public\.profiles/i);
    expect(sql).toMatch(/from\s+public\.user_purchases/i);
    expect(sql).toMatch(/from\s+public\.quiz_sessions/i);
    expect(sql).toMatch(/from\s+public\.quiz_session_questions/i);
    expect(sql).toMatch(/from\s+public\.quiz_answers/i);
    expect(sql).toMatch(/from\s+public\.quiz_attempts/i);
    expect(sql).not.toMatch(/submit_answer_calls/i);
    expect(sql).not.toMatch(/from\s+public\.content_packs/i);
    expect(sql).not.toMatch(/from\s+public\.phrases/i);
  });

  it("grants export_my_data to authenticated only and adds no client INSERT policy", () => {
    expect(sql).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.export_my_data\(\)\s+from\s+public/i,
    );
    expect(sql).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.export_my_data\(\)\s+from\s+anon/i,
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.export_my_data\(\)\s+to\s+authenticated/i,
    );
    expect(sql.match(/create policy[\s\S]*?\bfor insert\b/gi)).toBeNull();
  });
});
