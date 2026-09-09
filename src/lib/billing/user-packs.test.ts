import { describe, expect, it, vi } from "vitest";
import { fetchUserPacks, isPackOwned } from "@/lib/billing/user-packs";

describe("fetchUserPacks", () => {
  it("returns owned pack ids from user_purchases", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [{ pack_id: "travel" }, { pack_id: "survival" }],
      error: null,
    });
    const from = vi.fn().mockReturnValue({ select });

    await expect(fetchUserPacks({ from })).resolves.toEqual([
      "travel",
      "survival",
    ]);
    expect(from).toHaveBeenCalledWith("user_purchases");
    expect(select).toHaveBeenCalledWith("pack_id");
  });

  it("returns an empty list when the query fails", async () => {
    const select = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(
      fetchUserPacks({ from: vi.fn().mockReturnValue({ select }) }),
    ).resolves.toEqual([]);
  });
});

describe("isPackOwned", () => {
  it("is true only when the pack id is in the owned list", () => {
    expect(isPackOwned(["travel"], "travel")).toBe(true);
    expect(isPackOwned(["travel"], "survival")).toBe(false);
    expect(isPackOwned([], "travel")).toBe(false);
  });
});
