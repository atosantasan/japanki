import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  PENDING_CHECKOUT_STORAGE_KEY,
  PENDING_CHECKOUT_TTL_MS,
  clearPendingCheckoutPack,
  consumePendingCheckoutPack,
  getPendingCheckoutPack,
  setPendingCheckoutPack,
  stripPendingCheckoutQuery,
} from "./pending-checkout";

describe("pending checkout storage", () => {
  const sessionMap = new Map<string, string>();
  const localMap = new Map<string, string>();
  const replaceState = vi.fn();

  function mockStorage(map: Map<string, string>) {
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, val: string) => {
        map.set(key, val);
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
    };
  }

  beforeEach(() => {
    sessionMap.clear();
    localMap.clear();
    replaceState.mockReset();
    vi.stubGlobal("window", {
      sessionStorage: mockStorage(sessionMap),
      localStorage: mockStorage(localMap),
      location: { href: "https://japanki.test/en" },
      history: { state: null, replaceState },
    });
  });

  it("saves JSON with packId and storedAt to sessionStorage and localStorage", () => {
    const now = Date.parse("2026-09-20T08:00:00.000Z");
    setPendingCheckoutPack("travel", now);

    const expected = JSON.stringify({
      packId: "travel",
      storedAt: "2026-09-20T08:00:00.000Z",
    });
    expect(sessionMap.get(PENDING_CHECKOUT_STORAGE_KEY)).toBe(expected);
    expect(localMap.get(PENDING_CHECKOUT_STORAGE_KEY)).toBe(expected);
    expect(getPendingCheckoutPack(null, now)).toBe("travel");
  });

  it("ignores and deletes pending checkout after the 10 minute TTL", () => {
    const storedAt = Date.parse("2026-09-20T08:00:00.000Z");
    setPendingCheckoutPack("travel", storedAt);

    expect(
      getPendingCheckoutPack(null, storedAt + PENDING_CHECKOUT_TTL_MS),
    ).toBe("travel");
    expect(
      getPendingCheckoutPack(null, storedAt + PENDING_CHECKOUT_TTL_MS + 1),
    ).toBeNull();
    expect(sessionMap.has(PENDING_CHECKOUT_STORAGE_KEY)).toBe(false);
    expect(localMap.has(PENDING_CHECKOUT_STORAGE_KEY)).toBe(false);
  });

  it("treats a legacy raw pack id as expired and deletes it", () => {
    sessionMap.set(PENDING_CHECKOUT_STORAGE_KEY, "travel");
    localMap.set(PENDING_CHECKOUT_STORAGE_KEY, "travel");

    expect(getPendingCheckoutPack()).toBeNull();
    expect(sessionMap.has(PENDING_CHECKOUT_STORAGE_KEY)).toBe(false);
    expect(localMap.has(PENDING_CHECKOUT_STORAGE_KEY)).toBe(false);
  });

  it("recovers a still-fresh pack from localStorage if sessionStorage is empty", () => {
    const now = Date.parse("2026-09-20T08:00:00.000Z");
    localMap.set(
      PENDING_CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        packId: "travel",
        storedAt: "2026-09-20T08:00:00.000Z",
      }),
    );

    expect(getPendingCheckoutPack(null, now)).toBe("travel");
  });

  it("clears pending checkout pack id from both storages", () => {
    setPendingCheckoutPack("travel");
    clearPendingCheckoutPack();
    expect(getPendingCheckoutPack()).toBeNull();
    expect(sessionMap.has(PENDING_CHECKOUT_STORAGE_KEY)).toBe(false);
    expect(localMap.has(PENDING_CHECKOUT_STORAGE_KEY)).toBe(false);
  });

  it("reads pending pack from search params if present", () => {
    const searchParams = new URLSearchParams("checkout=travel");
    expect(getPendingCheckoutPack(searchParams)).toBe("travel");
  });

  it("consumes pending checkout once and strips the checkout query", () => {
    const now = Date.parse("2026-09-20T08:00:00.000Z");
    setPendingCheckoutPack("travel", now);
    window.location.href = "https://japanki.test/en?checkout=travel";

    expect(consumePendingCheckoutPack(null, now)).toBe("travel");
    expect(getPendingCheckoutPack(null, now)).toBeNull();
    expect(sessionMap.has(PENDING_CHECKOUT_STORAGE_KEY)).toBe(false);
    expect(localMap.has(PENDING_CHECKOUT_STORAGE_KEY)).toBe(false);
    expect(replaceState).toHaveBeenCalled();
    const nextUrl = String(replaceState.mock.calls[0]?.[2]);
    expect(nextUrl).not.toContain("checkout=");
  });

  it("does not restore a consumed pack on a later visit", () => {
    const now = Date.parse("2026-09-20T08:00:00.000Z");
    setPendingCheckoutPack("travel", now);
    consumePendingCheckoutPack(null, now);

    expect(getPendingCheckoutPack(null, now + 1_000)).toBeNull();
  });
});

describe("stripPendingCheckoutQuery", () => {
  it("is a no-op when the URL has no checkout params", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: { href: "https://japanki.test/en" },
      history: { state: null, replaceState },
    });
    stripPendingCheckoutQuery();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
