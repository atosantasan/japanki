import { describe, expect, it, vi } from "vitest";
import {
  PURCHASE_POLL_INTERVAL_MS,
  PURCHASE_POLL_TIMEOUT_MS,
  waitForPurchase,
} from "./wait-for-purchase";

describe("waitForPurchase", () => {
  it("returns confirmed when the first poll is purchased", async () => {
    const fetchStatus = vi.fn().mockResolvedValue(true);
    const sleep = vi.fn();

    await expect(
      waitForPurchase({
        packId: "travel",
        fetchStatus,
        sleep,
        now: () => 0,
      }),
    ).resolves.toEqual({ confirmed: true, timedOut: false });
    expect(sleep).not.toHaveBeenCalled();
  });

  it("polls until purchased becomes true", async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    let now = 0;
    const sleep = vi.fn(async (ms: number) => {
      now += ms;
    });

    await expect(
      waitForPurchase({
        packId: "travel",
        intervalMs: PURCHASE_POLL_INTERVAL_MS,
        timeoutMs: PURCHASE_POLL_TIMEOUT_MS,
        fetchStatus,
        sleep,
        now: () => now,
      }),
    ).resolves.toEqual({ confirmed: true, timedOut: false });
    expect(fetchStatus).toHaveBeenCalledTimes(3);
  });

  it("times out after the configured window when still unpurchased", async () => {
    const fetchStatus = vi.fn().mockResolvedValue(false);
    let now = 0;
    const sleep = vi.fn(async (ms: number) => {
      now += ms;
    });

    await expect(
      waitForPurchase({
        packId: "travel",
        intervalMs: 1_500,
        timeoutMs: 20_000,
        fetchStatus,
        sleep,
        now: () => now,
      }),
    ).resolves.toEqual({ confirmed: false, timedOut: true });
    expect(now).toBeGreaterThanOrEqual(20_000);
  });
});
