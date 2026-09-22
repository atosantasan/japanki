import { describe, expect, it } from "vitest";
import { HEART_RECOVERY_MINUTES, recoverHearts } from "@/lib/hearts/recovery";

describe("recoverHearts", () => {
  it("recovers one heart every 30 minutes without exceeding five", () => {
    const lastUpdated = new Date("2026-09-07T00:00:00.000Z");
    const now = new Date("2026-09-07T01:00:00.000Z");

    const result = recoverHearts({
      storedHearts: 2,
      lastHeartUpdatedAt: lastUpdated,
      now,
    });

    expect(HEART_RECOVERY_MINUTES).toBe(30);
    expect(result.hearts).toBe(4);
    expect(result.msUntilNext).toBe(30 * 60 * 1000);
  });

  it("returns a countdown while the next heart is still filling", () => {
    const lastUpdated = new Date("2026-09-07T00:00:00.000Z");
    const now = new Date("2026-09-07T00:20:00.000Z");
    const result = recoverHearts({
      storedHearts: 3,
      lastHeartUpdatedAt: lastUpdated,
      now,
    });

    expect(result.hearts).toBe(3);
    expect(result.msUntilNext).toBe(10 * 60 * 1000);
  });

  it("hides the timer when hearts are already full", () => {
    const result = recoverHearts({
      storedHearts: 5,
      lastHeartUpdatedAt: new Date("2026-09-07T00:00:00.000Z"),
      now: new Date("2026-09-07T03:00:00.000Z"),
    });

    expect(result.hearts).toBe(5);
    expect(result.msUntilNext).toBeNull();
  });
});

describe("shouldShowHeartsEmpty", () => {
  it("does not show the empty warning when stored hearts are 0 but recovery has refilled them", async () => {
    const { shouldShowHeartsEmpty } = await import("@/lib/hearts/recovery");
    expect(
      shouldShowHeartsEmpty({
        storedHearts: 0,
        lastHeartUpdatedAt: "2026-09-07T00:00:00.000Z",
        now: new Date("2026-09-07T03:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("shows the empty warning only when recovered hearts are still 0", async () => {
    const { shouldShowHeartsEmpty } = await import("@/lib/hearts/recovery");
    expect(
      shouldShowHeartsEmpty({
        storedHearts: 0,
        lastHeartUpdatedAt: "2026-09-07T00:00:00.000Z",
        now: new Date("2026-09-07T00:10:00.000Z"),
      }),
    ).toBe(true);
  });
});

describe("canPlayWithHearts", () => {
  it("blocks play only when remaining hearts are 0", async () => {
    const { canPlayWithHearts } = await import("@/lib/hearts/recovery");
    expect(canPlayWithHearts(0)).toBe(false);
    expect(canPlayWithHearts(1)).toBe(true);
  });
});

describe("toPlayableHearts", () => {
  it("recovers stored 0 after 150 minutes so a correct grade stays playable", async () => {
    const { canPlayWithHearts, recoverHearts, toPlayableHearts } = await import(
      "@/lib/hearts/recovery"
    );
    const lastHeartUpdatedAt = "2026-09-21T12:00:00.000Z";
    const now = new Date("2026-09-21T15:00:00.000Z");

    const playable = toPlayableHearts({
      remainingHearts: 0,
      updatedAt: lastHeartUpdatedAt,
      now,
    });

    expect(playable.remainingHearts).toBe(5);
    expect(canPlayWithHearts(playable.remainingHearts)).toBe(true);
    expect(
      recoverHearts({
        storedHearts: playable.remainingHearts,
        lastHeartUpdatedAt: new Date(playable.updatedAt),
        now,
      }).hearts,
    ).toBe(5);
  });

  it("does not double-count an already-consumed remaining value", async () => {
    const { toPlayableHearts } = await import("@/lib/hearts/recovery");
    const updatedAt = "2026-09-21T15:00:00.000Z";
    const now = new Date("2026-09-21T15:00:01.000Z");

    const playable = toPlayableHearts({
      remainingHearts: 4,
      updatedAt,
      now,
    });

    expect(playable.remainingHearts).toBe(4);
    expect(playable.updatedAt).toBe(new Date(updatedAt).toISOString());
  });

  it("keeps a partial refill aligned with header recoverHearts", async () => {
    const { recoverHearts, toPlayableHearts } = await import(
      "@/lib/hearts/recovery"
    );
    const lastHeartUpdatedAt = "2026-09-21T12:00:00.000Z";
    const now = new Date("2026-09-21T12:45:00.000Z");

    const playable = toPlayableHearts({
      remainingHearts: 2,
      updatedAt: lastHeartUpdatedAt,
      now,
    });

    expect(playable.remainingHearts).toBe(3);
    expect(
      recoverHearts({
        storedHearts: playable.remainingHearts,
        lastHeartUpdatedAt: new Date(playable.updatedAt),
        now,
      }).hearts,
    ).toBe(3);
  });
});
