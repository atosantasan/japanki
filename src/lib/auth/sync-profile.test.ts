import { describe, expect, it, vi } from "vitest";
import { syncProfileSafely } from "./sync-profile";

type SupabaseMock = Parameters<typeof syncProfileSafely>[0];

describe("syncProfileSafely", () => {
  it("does not call RPC when there is no active session / user", async () => {
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
    expect(result.data).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls RPC with preferred_language_param when session exists", async () => {
    const mockRow = {
      id: "user-123",
      is_anonymous: false,
      preferred_language: "ja",
      hearts: 5,
      last_heart_updated_at: "2026-09-08T00:00:00Z",
    };
    const mockRpc = vi.fn().mockResolvedValue({
      data: [mockRow],
      error: null,
    });
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: "user-123" },
            },
          },
          error: null,
        }),
      },
      rpc: mockRpc,
    } as unknown as SupabaseMock;

    const result = await syncProfileSafely(mockSupabase, "ja");
    expect(mockRpc).toHaveBeenCalledWith("sync_profile", {
      preferred_language_param: "ja",
    });
    expect(result.data).toEqual(mockRow);
    expect(result.error).toBeNull();
  });

  it("retries without parameters when parameter mismatch (PGRST202 / 400) occurs", async () => {
    const mockRow = {
      id: "user-123",
      is_anonymous: false,
      preferred_language: "en",
      hearts: 5,
      last_heart_updated_at: "2026-09-08T00:00:00Z",
    };
    const mockRpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function sync_profile(preferred_language_param) in the schema cache",
          status: 400,
        },
      })
      .mockResolvedValueOnce({
        data: [mockRow],
        error: null,
      });

    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: "user-123" },
            },
          },
          error: null,
        }),
      },
      rpc: mockRpc,
    } as unknown as SupabaseMock;

    const result = await syncProfileSafely(mockSupabase, "ja");
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenNthCalledWith(1, "sync_profile", {
      preferred_language_param: "ja",
    });
    expect(mockRpc).toHaveBeenNthCalledWith(2, "sync_profile", {});
    expect(result.data).toEqual(mockRow);
    expect(result.error).toBeNull();
  });

  it("safely handles unauthenticated error from RPC without throwing", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "Not authenticated",
        status: 400,
      },
    });

    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: "user-123" },
            },
          },
          error: null,
        }),
      },
      rpc: mockRpc,
    } as unknown as SupabaseMock;

    const result = await syncProfileSafely(mockSupabase, "ja");
    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
  });
});
