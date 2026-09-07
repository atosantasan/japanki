import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("link modal surface", () => {
  it("portals the auth modal to document.body so it is not trapped in the header stacking context", () => {
    const source = readFileSync(
      join(srcDir, "components/auth/AuthBar.tsx"),
      "utf8",
    );
    expect(source).toMatch(/createPortal/);
    expect(source).toMatch(/document\.body/);
  });

  it("clears stale auth errors when opening the link modal", () => {
    const source = readFileSync(
      join(srcDir, "components/auth/AuthProvider.tsx"),
      "utf8",
    );
    expect(source).toMatch(/const openLinkModal = useCallback\(/);
    const start = source.indexOf("const openLinkModal = useCallback");
    const snippet = source.slice(start, start + 400);
    expect(snippet).toMatch(/setAuthError\(null\)/);
    expect(snippet).toMatch(/setEmailSent\(false\)/);
  });
});
