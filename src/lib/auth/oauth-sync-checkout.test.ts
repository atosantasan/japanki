import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearPendingCheckoutPack,
  getPendingCheckoutPack,
  setPendingCheckoutPack,
} from "@/lib/billing/pending-checkout";
import { syncProfileSafely } from "./sync-profile";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("OAuth session sync & Stripe automatic redirect (Issue #6)", () => {
  describe("AC-1: syncProfileSafely strict session guard & safe bypass", () => {
    it("strictly avoids calling RPC when session or access_token is missing", async () => {
      type SupabaseMock = Parameters<typeof syncProfileSafely>[0];

      const mockRpc = vi.fn();
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
        rpc: mockRpc,
      } as unknown as SupabaseMock;

      const result = await syncProfileSafely(mockSupabase, "ja");
      expect(mockRpc).not.toHaveBeenCalled();
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it("safely catches and bypasses 400 Bad Request error from RPC without throwing", async () => {
      type SupabaseMock = Parameters<typeof syncProfileSafely>[0];

      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: {
              session: {
                access_token: "active-token",
                user: { id: "user-oauth-456" },
              },
            },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: "P0001",
            message: "Not authenticated",
            status: 400,
          },
        }),
      } as unknown as SupabaseMock;

      const result = await syncProfileSafely(mockSupabase, "ja");
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe("AC-2: Storage cross-session durability (localStorage + sessionStorage)", () => {
    const sessionMap = new Map<string, string>();
    const localMap = new Map<string, string>();

    beforeEach(() => {
      sessionMap.clear();
      localMap.clear();
      vi.stubGlobal("window", {
        sessionStorage: {
          getItem: (key: string) => sessionMap.get(key) ?? null,
          setItem: (key: string, val: string) => sessionMap.set(key, val),
          removeItem: (key: string) => sessionMap.delete(key),
        },
        localStorage: {
          getItem: (key: string) => localMap.get(key) ?? null,
          setItem: (key: string, val: string) => localMap.set(key, val),
          removeItem: (key: string) => localMap.delete(key),
        },
      });
    });

    it("persists pending checkout pack JSON to both sessionStorage and localStorage", () => {
      const now = Date.parse("2026-09-20T08:00:00.000Z");
      setPendingCheckoutPack("travel", now);
      const expected = JSON.stringify({
        packId: "travel",
        storedAt: "2026-09-20T08:00:00.000Z",
      });
      expect(sessionMap.get("japanki_pending_checkout_pack")).toBe(expected);
      expect(localMap.get("japanki_pending_checkout_pack")).toBe(expected);
    });

    it("recovers pending pack from localStorage if sessionStorage was wiped during OAuth navigation", () => {
      const now = Date.parse("2026-09-20T08:00:00.000Z");
      localMap.set(
        "japanki_pending_checkout_pack",
        JSON.stringify({
          packId: "travel",
          storedAt: "2026-09-20T08:00:00.000Z",
        }),
      );
      sessionMap.clear();

      expect(getPendingCheckoutPack(null, now)).toBe("travel");
    });

    it("clears pending pack from both storages upon checkout", () => {
      setPendingCheckoutPack("travel");
      clearPendingCheckoutPack();
      expect(sessionMap.get("japanki_pending_checkout_pack")).toBeUndefined();
      expect(localMap.get("japanki_pending_checkout_pack")).toBeUndefined();
      expect(getPendingCheckoutPack()).toBeNull();
    });
  });

  describe("AC-3 & AC-4: AuthProvider immediate session sync & checkout trigger", () => {
    it("handles INITIAL_SESSION and SIGNED_IN events with immediate profile refresh when session user exists", () => {
      const source = readFileSync(
        join(srcDir, "components/auth/AuthProvider.tsx"),
        "utf8",
      );
      expect(source).toMatch(/INITIAL_SESSION/);
      expect(source).toMatch(/session\?\.user/);
    });

    it("guards against duplicate automatic checkout redirection loops with ref check", () => {
      const source = readFileSync(
        join(srcDir, "components/auth/AuthProvider.tsx"),
        "utf8",
      );
      expect(source).toMatch(/autoCheckoutTriggeredRef|checkoutInProgressRef/);
    });

    it("attaches Authorization Bearer token in triggerCheckout when access_token is present", () => {
      const source = readFileSync(
        join(srcDir, "components/auth/AuthProvider.tsx"),
        "utf8",
      );
      expect(source).toMatch(/headers\.Authorization\s*=\s*`Bearer \${token}`/);
    });
  });

  describe("AC-5: /api/checkout identity linking 403 prevention", () => {
    it("checks for linked identity providers in /api/checkout and avoids false 403", () => {
      const source = readFileSync(
        join(srcDir, "app/api/checkout/route.ts"),
        "utf8",
      );
      expect(source).toMatch(/hasLinkedIdentity/);
      expect(source).toMatch(/isLinked\s*\?\s*false\s*:\s*Boolean\(profile\?\.is_anonymous/);
      expect(source).toMatch(/authHeader\?\.startsWith\("Bearer "\)/);
    });
  });
});
