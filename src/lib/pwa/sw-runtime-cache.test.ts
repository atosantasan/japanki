import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("service worker runtime cache", () => {
  it("registers a NetworkOnly rule before defaultCache so supabase is never cached", () => {
    const source = readFileSync(join(rootDir, "src/sw.ts"), "utf8");
    expect(source).toMatch(/NetworkOnly/);
    expect(source).toMatch(/shouldBypassServiceWorkerCache/);
    expect(source).toMatch(
      /runtimeCaching:\s*\[\s*\{[\s\S]*handler:\s*networkOnly[\s\S]*\.\.\.defaultCache/,
    );
  });
});
