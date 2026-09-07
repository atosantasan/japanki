import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("home navigation surface", () => {
  it("makes the header brand a locale-aware link to home", () => {
    const source = readFileSync(
      join(srcDir, "components/AppHeader.tsx"),
      "utf8",
    );
    expect(source).toMatch(/from "@\/i18n\/navigation"/);
    expect(source).toMatch(/href="\/"/);
    expect(source).toMatch(/<Link[\s\S]*href="\/"/);
  });
});
