import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Issue #20 account privacy surfaces", () => {
  it("exposes export and confirmed delete actions on the account panel", () => {
    const source = readFileSync(
      join(srcDir, "components/billing/AccountPanel.tsx"),
      "utf8",
    );
    expect(source).toMatch(/\/api\/account\/export/);
    expect(source).toMatch(/\/api\/account\/delete/);
    expect(source).toMatch(/ACCOUNT_DELETION_CONFIRM_TEXT/);
    expect(source).toMatch(/clearPendingCheckoutPack/);
    expect(source).toMatch(/signOut/);
    expect(source).not.toMatch(/SUPABASE_SECRET_KEY/);
    expect(source).not.toMatch(/STRIPE_SECRET_KEY/);
    expect(source).not.toMatch(/createAdminSupabaseClient/);
  });

  it("exports through the user session RPC and never uses the admin client", () => {
    const source = readFileSync(
      join(srcDir, "app/api/account/export/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/export_my_data/);
    expect(source).toMatch(/createServerSupabaseClient/);
    expect(source).not.toMatch(/createAdminSupabaseClient/);
    expect(source).not.toMatch(/from\("quiz_answers"\)/);
    expect(source).not.toMatch(/from\("submit_answer_calls"\)/);
    expect(source).not.toMatch(/SUPABASE_SECRET_KEY/);
  });

  it("deletes via admin deleteUser after capturing the session user", () => {
    const source = readFileSync(
      join(srcDir, "app/api/account/delete/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/deleteUser/);
    expect(source).toMatch(/customers\.del|deleteCustomer/);
    expect(source).not.toMatch(/canStartCheckout/);
    expect(source).not.toMatch(/identity_linking_required/);
    expect(source).not.toMatch(/grantPurchase/);
  });
});
