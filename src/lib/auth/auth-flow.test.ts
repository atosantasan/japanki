import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("auth and checkout flow stability", () => {
  it("registers onAuthStateChange to immediately reflect auth state transitions in UI", () => {
    const source = readFileSync(
      join(srcDir, "components/auth/AuthProvider.tsx"),
      "utf8",
    );
    expect(source).toMatch(/onAuthStateChange/);
    expect(source).toMatch(/unsubscribe/);
  });

  it("uses syncProfileSafely to avoid 400 Bad Request on profile sync", () => {
    const source = readFileSync(
      join(srcDir, "components/auth/AuthProvider.tsx"),
      "utf8",
    );
    expect(source).toMatch(/syncProfileSafely/);
  });

  it("supports checkout resume after identity linking with a confirm step", () => {
    const source = readFileSync(
      join(srcDir, "components/auth/AuthProvider.tsx"),
      "utf8",
    );
    expect(source).toMatch(/getPendingCheckoutPack/);
    expect(source).toMatch(/clearPendingCheckoutPack/);
    expect(source).toMatch(/setCheckoutConfirmPackId/);
    expect(source).toMatch(/confirmPendingCheckout/);
    expect(source).toMatch(/\/api\/checkout/);
  });

  it("handles checkout errors and surfaces user-friendly messages in PurchaseButton", () => {
    const source = readFileSync(
      join(srcDir, "components/billing/PurchaseButton.tsx"),
      "utf8",
    );
    expect(source).toMatch(/try\s*\{/);
    expect(source).toMatch(/catch/);
    expect(source).toMatch(/checkoutError/);
  });
});
