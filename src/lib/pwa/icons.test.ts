import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function pngSize(buffer: Buffer): { width: number; height: number } {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe("production PWA icons", () => {
  it("ships 192x192 and 512x512 PNG icons that are not tiny placeholders", () => {
    const icon192 = readFileSync(join(rootDir, "public/icon-192.png"));
    const icon512 = readFileSync(join(rootDir, "public/icon-512.png"));

    expect(icon192.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(icon512.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(pngSize(icon192)).toEqual({ width: 192, height: 192 });
    expect(pngSize(icon512)).toEqual({ width: 512, height: 512 });
    expect(icon192.byteLength).toBeGreaterThan(5_000);
    expect(icon512.byteLength).toBeGreaterThan(15_000);
  });

  it("registers both icon sizes in the web app manifest", () => {
    const source = readFileSync(join(rootDir, "src/app/manifest.ts"), "utf8");
    expect(source).toMatch(/\/icon-192\.png/);
    expect(source).toMatch(/\/icon-512\.png/);
    expect(source).toMatch(/192x192/);
    expect(source).toMatch(/512x512/);
  });
});
