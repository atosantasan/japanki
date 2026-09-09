import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("purchase grant surfaces", () => {
  it("does not grant purchases from the success page", () => {
    const source = readFileSync(
      join(srcDir, "app/[locale]/success/page.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/user_purchases/);
    expect(source).not.toMatch(/grantPurchase/);
    expect(source).not.toMatch(/STRIPE_SECRET_KEY/);
  });

  it("does not grant purchases from the checkout API", () => {
    const source = readFileSync(
      join(srcDir, "app/api/checkout/route.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/grantPurchase/);
    expect(source).not.toMatch(/\.insert\(/);
    expect(source).toMatch(/user_purchases/);
    expect(source).toMatch(/customer_email/);
    expect(source).toMatch(/customer_creation/);
  });

  it("does not grant purchases from the billing portal API or account page", () => {
    const portal = readFileSync(
      join(srcDir, "app/api/billing/portal/route.ts"),
      "utf8",
    );
    const account = readFileSync(
      join(srcDir, "app/[locale]/account/page.tsx"),
      "utf8",
    );
    expect(portal).not.toMatch(/grantPurchase/);
    expect(portal).not.toMatch(/user_purchases/);
    expect(account).not.toMatch(/grantPurchase/);
    expect(account).not.toMatch(/\.insert\(/);
  });
});
