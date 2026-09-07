import { describe, expect, it } from "vitest";
import { resolvePhraseAccess } from "@/lib/phrases/access";

describe("resolvePhraseAccess", () => {
  it("rejects unauthenticated requests before looking at purchases", () => {
    const result = resolvePhraseAccess({
      userId: null,
      pack: { id: "survival", is_free: true },
      hasPurchase: false,
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Not authenticated",
    });
  });

  it("rejects unknown packs", () => {
    const result = resolvePhraseAccess({
      userId: "user-1",
      pack: null,
      hasPurchase: false,
    });

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "Content pack not found",
    });
  });

  it("allows authenticated access to free packs without a purchase", () => {
    const result = resolvePhraseAccess({
      userId: "user-1",
      pack: { id: "survival", is_free: true },
      hasPurchase: false,
    });

    expect(result).toEqual({ ok: true });
  });

  it("blocks paid packs when the user has no purchase row", () => {
    const result = resolvePhraseAccess({
      userId: "user-1",
      pack: { id: "travel", is_free: false },
      hasPurchase: false,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "Purchased pack permission required",
    });
  });

  it("allows paid packs only when user_purchases contains this user", () => {
    const result = resolvePhraseAccess({
      userId: "user-1",
      pack: { id: "travel", is_free: false },
      hasPurchase: true,
    });

    expect(result).toEqual({ ok: true });
  });
});
