import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Issue #19 success purchase polling", () => {
  const gate = readFileSync(
    join(srcDir, "components/billing/SuccessPurchaseGate.tsx"),
    "utf8",
  );
  const page = readFileSync(
    join(srcDir, "app/[locale]/success/page.tsx"),
    "utf8",
  );
  const route = readFileSync(
    join(srcDir, "app/api/billing/purchase-status/route.ts"),
    "utf8",
  );

  it("polls purchase-status from the success page without granting access", () => {
    expect(page).toMatch(/SuccessPurchaseGate/);
    expect(page).not.toMatch(/grantPurchase/);
    expect(page).not.toMatch(/user_purchases/);
    expect(gate).toMatch(/waitForPurchase/);
    expect(gate).toMatch(/refreshProfile/);
    expect(gate).not.toMatch(/grantPurchase/);
  });

  it("keeps the travel CTA disabled until purchase is confirmed", () => {
    expect(gate).toMatch(/phase === "confirmed"/);
    expect(gate).toMatch(/disabled/);
    expect(gate).toMatch(/confirming/);
  });

  it("shows retry and contact fallback when polling times out", () => {
    expect(gate).toMatch(/timedOut/);
    expect(gate).toMatch(/retry/);
    expect(gate).toMatch(/CONTACT_EMAIL/);
    expect(gate).toMatch(/mailto:\$\{CONTACT_EMAIL\}/);
    expect(gate).toMatch(/runPoll|waitForPurchase/);
  });

  it("reads purchase-status with the cookie session instead of the admin client", () => {
    expect(route).toMatch(/createServerSupabaseClient/);
    expect(route).not.toMatch(/createAdminSupabaseClient/);
    expect(route).toMatch(/user_purchases/);
    expect(route).not.toMatch(/\.insert\(/);
  });
});
