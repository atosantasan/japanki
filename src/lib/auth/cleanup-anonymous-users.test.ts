import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ANONYMOUS_RETENTION_DAYS } from "@/lib/constants/app";
import {
  cleanupAnonymousUsers,
  handleAnonymousCleanupRequest,
  selectAnonymousUserIdsForCleanup,
} from "@/lib/auth/cleanup-anonymous-users";

const now = new Date("2026-09-21T00:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("selectAnonymousUserIdsForCleanup", () => {
  it("keeps the retention window as a named constant of 30 days", () => {
    expect(ANONYMOUS_RETENTION_DAYS).toBe(30);
  });

  it("selects anonymous profiles older than the retention window with no purchases", () => {
    const ids = selectAnonymousUserIdsForCleanup({
      profiles: [
        { id: "old-anon", is_anonymous: true, created_at: daysAgo(31) },
      ],
      purchasedUserIds: [],
      now,
    });

    expect(ids).toEqual(["old-anon"]);
  });

  it("does not select anonymous profiles still inside the retention window", () => {
    const ids = selectAnonymousUserIdsForCleanup({
      profiles: [
        { id: "fresh-anon", is_anonymous: true, created_at: daysAgo(29) },
      ],
      purchasedUserIds: [],
      now,
    });

    expect(ids).toEqual([]);
  });

  it("does not select non-anonymous profiles even when they are old", () => {
    const ids = selectAnonymousUserIdsForCleanup({
      profiles: [
        { id: "old-linked", is_anonymous: false, created_at: daysAgo(40) },
      ],
      purchasedUserIds: [],
      now,
    });

    expect(ids).toEqual([]);
  });

  it("does not select anonymous profiles that have a purchase row", () => {
    const ids = selectAnonymousUserIdsForCleanup({
      profiles: [
        { id: "anon-buyer", is_anonymous: true, created_at: daysAgo(40) },
      ],
      purchasedUserIds: ["anon-buyer"],
      now,
    });

    expect(ids).toEqual([]);
  });
});

describe("cleanupAnonymousUsers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes only matching auth users and logs the deleted count", async () => {
    const deleteAuthUser = vi.fn().mockResolvedValue(undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const result = await cleanupAnonymousUsers(
      {
        listAnonymousProfiles: vi.fn().mockResolvedValue([
          { id: "old-anon", is_anonymous: true, created_at: daysAgo(31) },
          { id: "fresh-anon", is_anonymous: true, created_at: daysAgo(1) },
          { id: "old-linked", is_anonymous: false, created_at: daysAgo(40) },
          { id: "anon-buyer", is_anonymous: true, created_at: daysAgo(40) },
        ]),
        listPurchasedUserIds: vi.fn().mockResolvedValue(["anon-buyer"]),
        deleteAuthUser,
      },
      { now },
    );

    expect(deleteAuthUser).toHaveBeenCalledTimes(1);
    expect(deleteAuthUser).toHaveBeenCalledWith("old-anon");
    expect(result).toEqual({ deleted: 1, failed: 0 });
    expect(info).toHaveBeenCalledWith(
      "Anonymous user cleanup",
      expect.objectContaining({ deleted: 1, failed: 0 }),
    );
  });
});

describe("handleAnonymousCleanupRequest", () => {
  it("rejects requests without a matching CRON_SECRET bearer token", async () => {
    const deleteAuthUser = vi.fn();
    const result = await handleAnonymousCleanupRequest({
      authorizationHeader: "Bearer wrong",
      cronSecret: "cron-secret",
      store: {
        listAnonymousProfiles: vi.fn(),
        listPurchasedUserIds: vi.fn(),
        deleteAuthUser,
      },
    });

    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: "unauthorized" });
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("runs cleanup when the cron bearer token matches", async () => {
    const result = await handleAnonymousCleanupRequest({
      authorizationHeader: "Bearer cron-secret",
      cronSecret: "cron-secret",
      store: {
        listAnonymousProfiles: vi.fn().mockResolvedValue([
          { id: "old-anon", is_anonymous: true, created_at: daysAgo(31) },
        ]),
        listPurchasedUserIds: vi.fn().mockResolvedValue([]),
        deleteAuthUser: vi.fn().mockResolvedValue(undefined),
      },
      now,
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ deleted: 1, failed: 0 });
  });
});

describe("anonymous cleanup scheduling", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

  it("exposes a Vercel Cron path authenticated by CRON_SECRET", () => {
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    expect(vercel.crons).toEqual([
      {
        path: "/api/internal/cleanup-anonymous-users",
        schedule: "0 3 * * *",
      },
    ]);

    const route = readFileSync(
      join(root, "src/app/api/internal/cleanup-anonymous-users/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/process\.env\.CRON_SECRET/);
    expect(route).toMatch(/export async function GET/);
    expect(route).toMatch(/export async function POST/);
    expect(route).toMatch(/auth\.admin\.deleteUser/);
  });
});
