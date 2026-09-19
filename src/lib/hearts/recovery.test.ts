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
