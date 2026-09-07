import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("google oauth start surface", () => {
  it("uses a query-free callback URL and persists next in a cookie", () => {
    const source = readFileSync(
      join(srcDir, "components/auth/AuthProvider.tsx"),
      "utf8",
    );
    expect(source).toMatch(/authCallbackUrl\(/);
    expect(source).toMatch(/persistAuthNextPath\(/);
    expect(source).toMatch(/skipBrowserRedirect:\s*true/);
    expect(source).not.toMatch(
      /\/auth\/callback\?next=\$\{encodeURIComponent\(nextPath\)\}/,
    );
  });

  it("reads the next path from the auth cookie in the callback route", () => {
    const source = readFileSync(
      join(srcDir, "app/auth/callback/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/resolveAuthNextPath/);
    expect(source).toMatch(/AUTH_NEXT_COOKIE/);
  });
});
