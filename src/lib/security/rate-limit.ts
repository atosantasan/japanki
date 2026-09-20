import { RATE_LIMIT_WINDOW_MS } from "@/lib/constants/app";

const hitsByKey = new Map<string, number[]>();

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs = RATE_LIMIT_WINDOW_MS,
  now = Date.now(),
): boolean {
  const cutoff = now - windowMs;
  const recent = (hitsByKey.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= limit) {
    hitsByKey.set(key, recent);
    return false;
  }

  recent.push(now);
  hitsByKey.set(key, recent);
  return true;
}

export function resetRateLimitStoreForTests(): void {
  hitsByKey.clear();
}
