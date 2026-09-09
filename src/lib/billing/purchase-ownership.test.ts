import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("owned pack UI and checkout guard surfaces", () => {
  it("loads owned pack ids in AuthProvider during profile sync", () => {
    const source = readFileSync(
      join(srcDir, "components/auth/AuthProvider.tsx"),
      "utf8",
    );
    expect(source).toMatch(/fetchUserPacks/);
    expect(source).toMatch(/ownedPackIds/);
    expect(source).toMatch(/setOwnedPackIds\(\[\]\)/);
  });

  it("switches PurchaseButton from checkout to quiz when the pack is owned", () => {
    const source = readFileSync(
      join(srcDir, "components/billing/PurchaseButton.tsx"),
      "utf8",
    );
    expect(source).toMatch(/isPackOwned/);
    expect(source).toMatch(/playOwned/);
    expect(source).toMatch(/\/quiz\/\$\{packId\}/);
    expect(source).toMatch(/from "@\/i18n\/navigation"/);
  });

  it("guards /api/checkout against duplicate purchases before creating a Stripe session", () => {
    const source = readFileSync(
      join(srcDir, "app/api/checkout/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/rejectIfAlreadyOwned/);
    expect(source).toMatch(/user_purchases/);
    expect(source).toMatch(/ownershipGuard\.error/);
    expect(source).toMatch(/ownershipGuard\.code/);
    expect(source).not.toMatch(/grantPurchase/);
    expect(source).not.toMatch(/\.insert\(/);
    const stripeIndex = source.indexOf("stripe.checkout.sessions.create");
    const guardIndex = source.search(/rejectIfAlreadyOwned|user_purchases/);
    expect(guardIndex).toBeGreaterThan(-1);
    expect(stripeIndex).toBeGreaterThan(guardIndex);
  });
});
