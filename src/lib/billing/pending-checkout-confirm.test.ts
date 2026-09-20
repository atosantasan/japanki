import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Issue #18 pending checkout confirmation", () => {
  const provider = readFileSync(
    join(srcDir, "components/auth/AuthProvider.tsx"),
    "utf8",
  );
  const bar = readFileSync(join(srcDir, "components/auth/AuthBar.tsx"), "utf8");
  const pending = readFileSync(
    join(srcDir, "lib/billing/pending-checkout.ts"),
    "utf8",
  );

  it("keeps localStorage as an OAuth fallback with an explicit TTL comment", () => {
    expect(pending).toMatch(/Issue #6/);
    expect(pending).toMatch(/Safari/);
    expect(pending).toMatch(/PENDING_CHECKOUT_TTL_MS/);
    expect(pending).toMatch(/localStorage/);
    expect(pending).toMatch(/sessionStorage/);
  });

  it("does not auto-redirect to checkout when a pending pack is found", () => {
    const effectStart = provider.indexOf("const targetPack =");
    const effect = provider.slice(effectStart, effectStart + 900);
    expect(effect).toMatch(/setCheckoutConfirmPackId\(targetPack\)/);
    expect(effect).not.toMatch(/await triggerCheckout\(targetPack\)/);
    expect(effect).toMatch(/consumePendingCheckoutPack\(searchParams\)/);
  });

  it("continues to checkout only after the confirm action", () => {
    expect(provider).toMatch(/confirmPendingCheckout/);
    const start = provider.indexOf("const confirmPendingCheckout");
    const snippet = provider.slice(start, start + 450);
    expect(snippet).toMatch(/triggerCheckout/);
    expect(snippet).toMatch(/setCheckoutConfirmPackId\(null\)/);
  });

  it("cancels without calling checkout and keeps storage cleared", () => {
    expect(provider).toMatch(/cancelPendingCheckout/);
    const start = provider.indexOf("const cancelPendingCheckout");
    const snippet = provider.slice(start, start + 400);
    expect(snippet).toMatch(/clearPendingCheckoutPack\(\)/);
    expect(snippet).not.toMatch(/triggerCheckout/);
    expect(bar).toMatch(/confirmPendingCheckout/);
    expect(bar).toMatch(/cancelPendingCheckout/);
    expect(bar).toMatch(/checkoutConfirmContinue/);
    expect(bar).toMatch(/checkoutConfirmCancel/);
  });
});
