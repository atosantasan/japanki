import { describe, expect, it, vi } from "vitest";
import { getPurchaseStatusForRequest } from "./purchase-status";

describe("getPurchaseStatusForRequest", () => {
  it("returns 401 when the session has no user", async () => {
    const result = await getPurchaseStatusForRequest("travel", {
      getUser: vi.fn().mockResolvedValue(null),
      hasPurchase: vi.fn(),
    });

    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: "unauthenticated" });
  });

  it("returns 400 when pack_id is missing", async () => {
    const result = await getPurchaseStatusForRequest("", {
      getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      hasPurchase: vi.fn(),
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "pack_id is required" });
  });

  it("returns purchased true when user_purchases has the pack", async () => {
    const hasPurchase = vi.fn().mockResolvedValue(true);

    const result = await getPurchaseStatusForRequest("travel", {
      getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      hasPurchase,
    });

    expect(hasPurchase).toHaveBeenCalledWith("user-1", "travel");
    expect(result).toEqual({
      status: 200,
      body: { purchased: true },
    });
  });

  it("returns purchased false when the user has not bought the pack", async () => {
    const result = await getPurchaseStatusForRequest("travel", {
      getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      hasPurchase: vi.fn().mockResolvedValue(false),
    });

    expect(result).toEqual({
      status: 200,
      body: { purchased: false },
    });
  });
});
