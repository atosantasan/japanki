export const PURCHASE_POLL_INTERVAL_MS = 1_500;
export const PURCHASE_POLL_TIMEOUT_MS = 20_000;

export type WaitForPurchaseResult = {
  confirmed: boolean;
  timedOut: boolean;
};

export type WaitForPurchaseOptions = {
  packId: string;
  intervalMs?: number;
  timeoutMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  fetchStatus?: (packId: string) => Promise<boolean>;
  signal?: AbortSignal;
};

export async function fetchPurchaseStatus(packId: string): Promise<boolean> {
  const response = await fetch(
    `/api/billing/purchase-status?pack_id=${encodeURIComponent(packId)}`,
    { credentials: "include" },
  );
  if (!response.ok) {
    return false;
  }
  const json = (await response.json()) as { purchased?: unknown };
  return json.purchased === true;
}

export async function waitForPurchase(
  options: WaitForPurchaseOptions,
): Promise<WaitForPurchaseResult> {
  const intervalMs = options.intervalMs ?? PURCHASE_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? PURCHASE_POLL_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      }));
  const fetchStatus = options.fetchStatus ?? fetchPurchaseStatus;
  const startedAt = now();

  while (true) {
    if (options.signal?.aborted) {
      return { confirmed: false, timedOut: false };
    }

    try {
      if (await fetchStatus(options.packId)) {
        return { confirmed: true, timedOut: false };
      }
    } catch {
      // Keep polling through transient network errors.
    }

    if (now() - startedAt >= timeoutMs) {
      return { confirmed: false, timedOut: true };
    }

    await sleep(intervalMs);
  }
}
