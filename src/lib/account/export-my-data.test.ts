import { describe, expect, it, vi } from "vitest";
import { exportMyDataForRequest } from "@/lib/account/export-my-data";

describe("exportMyDataForRequest", () => {
  it("returns 401 when the session has no user", async () => {
    const exportMyData = vi.fn();

    const result = await exportMyDataForRequest({
      getUser: vi.fn().mockResolvedValue(null),
      exportMyData,
    });

    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: "unauthenticated" });
    expect(exportMyData).not.toHaveBeenCalled();
  });

  it("returns the RPC payload scoped by session plus auth identifiers", async () => {
    const exportMyData = vi.fn().mockResolvedValue({
      profile: { id: "user-1", preferred_language: "en" },
      purchases: [{ pack_id: "travel" }],
      quiz_sessions: [],
    });

    const result = await exportMyDataForRequest({
      getUser: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "traveler@example.com",
        isAnonymous: false,
        providers: ["google"],
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      exportMyData,
    });

    expect(exportMyData).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(200);
    expect(result.filename).toMatch(/^japanki-export-user-1-/);
    expect(result.body).toMatchObject({
      auth: {
        id: "user-1",
        email: "traveler@example.com",
        is_anonymous: false,
        providers: ["google"],
        created_at: "2026-01-01T00:00:00.000Z",
      },
      profile: { id: "user-1", preferred_language: "en" },
      purchases: [{ pack_id: "travel" }],
      quiz_sessions: [],
    });
    expect(result.body).not.toHaveProperty("submit_answer_calls");
  });

  it("returns 500 when the export RPC fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await exportMyDataForRequest({
      getUser: vi.fn().mockResolvedValue({
        id: "user-1",
        email: null,
        isAnonymous: true,
        providers: ["anonymous"],
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      exportMyData: vi.fn().mockRejectedValue(new Error("rpc failed")),
    });

    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: "Unable to export data" });
    error.mockRestore();
  });
});
