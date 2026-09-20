import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry) && !entry.includes(".test.")) {
      files.push(full);
    }
  }
  return files;
}

describe("client secret leakage", () => {
  it("does not reference secret keys in client components or NEXT_PUBLIC bindings", () => {
    const files = collectSourceFiles(srcDir);
    const clientFiles = files.filter((file) => file.endsWith(".tsx"));

    for (const file of clientFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/SUPABASE_SECRET_KEY/);
      expect(source).not.toMatch(/STRIPE_SECRET_KEY/);
      expect(source).not.toMatch(/STRIPE_WEBHOOK_SECRET/);
      expect(source).not.toMatch(/CRON_SECRET/);
    }

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/process\.env\.NEXT_PUBLIC_SUPABASE_SECRET_KEY/);
      expect(source).not.toMatch(/process\.env\.NEXT_PUBLIC_STRIPE_SECRET_KEY/);
      expect(source).not.toMatch(/process\.env\.NEXT_PUBLIC_CRON_SECRET/);
    }
  });
});
