import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  clearPendingCheckoutPack,
  getPendingCheckoutPack,
  setPendingCheckoutPack,
} from "./pending-checkout";

describe("pending checkout storage", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      length: store.size,
      key: () => null,
    };
    vi.stubGlobal("window", { sessionStorage: mockStorage });
  });

  it("saves and retrieves pending checkout pack id from sessionStorage", () => {
    expect(getPendingCheckoutPack()).toBeNull();
    setPendingCheckoutPack("travel");
    expect(getPendingCheckoutPack()).toBe("travel");
  });

  it("clears pending checkout pack id", () => {
    setPendingCheckoutPack("travel");
    clearPendingCheckoutPack();
    expect(getPendingCheckoutPack()).toBeNull();
  });

  it("reads pending pack from search params if present", () => {
    const searchParams = new URLSearchParams("checkout=travel");
    expect(getPendingCheckoutPack(searchParams)).toBe("travel");
  });
});
