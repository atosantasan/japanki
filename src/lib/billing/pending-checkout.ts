const PENDING_CHECKOUT_STORAGE_KEY = "japanki_pending_checkout_pack";

// 10 minutes, matching japanki_auth_next Max-Age=600.
export const PENDING_CHECKOUT_TTL_MS = 10 * 60 * 1000;

// Keep localStorage alongside sessionStorage. Issue #6 added the dual write
// because sessionStorage can be empty after a top-level OAuth round-trip
// (Safari ITP and similar). That wipe was never empirically confirmed, so do
// not drop localStorage without that check. Shared-device risk is mitigated
// by this TTL and by a confirm step before Checkout (Issue #18).

export { PENDING_CHECKOUT_STORAGE_KEY };

export type PendingCheckoutRecord = {
  packId: string;
  storedAt: string;
};

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function parsePendingRecord(raw: string | null): PendingCheckoutRecord | null {
  if (!raw || !raw.trim()) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as {
      packId?: unknown;
      storedAt?: unknown;
    };
    if (
      typeof parsed.packId !== "string" ||
      parsed.packId.trim().length === 0 ||
      typeof parsed.storedAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.storedAt))
    ) {
      return null;
    }
    return { packId: parsed.packId.trim(), storedAt: parsed.storedAt };
  } catch {
    return null;
  }
}

function isExpired(storedAt: string, now: number): boolean {
  return now - Date.parse(storedAt) > PENDING_CHECKOUT_TTL_MS;
}

function readStorage(
  storage: WebStorage | undefined,
  now: number,
): string | null {
  if (!storage) {
    return null;
  }
  let raw: string | null = null;
  try {
    raw = storage.getItem(PENDING_CHECKOUT_STORAGE_KEY);
  } catch {
    return null;
  }
  const record = parsePendingRecord(raw);
  if (!record || isExpired(record.storedAt, now)) {
    try {
      storage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
    } catch {
      // ignore
    }
    return null;
  }
  return record.packId;
}

function writeStorage(storage: WebStorage | undefined, value: string): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(PENDING_CHECKOUT_STORAGE_KEY, value);
  } catch {
    // ignore quota or disabled storage
  }
}

function removeStorage(storage: WebStorage | undefined): void {
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getPendingCheckoutPack(
  searchParams?: URLSearchParams | null,
  now: number = Date.now(),
): string | null {
  if (searchParams) {
    const fromQuery =
      searchParams.get("checkout") || searchParams.get("checkout_pack");
    if (fromQuery && fromQuery.trim()) {
      return fromQuery.trim();
    }
  }

  if (typeof window === "undefined") {
    return null;
  }

  return (
    readStorage(window.sessionStorage, now) ??
    readStorage(window.localStorage, now)
  );
}

export function setPendingCheckoutPack(
  packId: string,
  now: number = Date.now(),
): void {
  if (typeof window === "undefined") {
    return;
  }
  const payload = JSON.stringify({
    packId,
    storedAt: new Date(now).toISOString(),
  });
  writeStorage(window.sessionStorage, payload);
  writeStorage(window.localStorage, payload);
}

export function clearPendingCheckoutPack(): void {
  if (typeof window === "undefined") {
    return;
  }
  removeStorage(window.sessionStorage);
  removeStorage(window.localStorage);
}

export function stripPendingCheckoutQuery(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const url = new URL(window.location.href);
    if (
      !url.searchParams.has("checkout") &&
      !url.searchParams.has("checkout_pack")
    ) {
      return;
    }
    url.searchParams.delete("checkout");
    url.searchParams.delete("checkout_pack");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    // ignore
  }
}

export function consumePendingCheckoutPack(
  searchParams?: URLSearchParams | null,
  now: number = Date.now(),
): string | null {
  const packId = getPendingCheckoutPack(searchParams, now);
  clearPendingCheckoutPack();
  stripPendingCheckoutQuery();
  return packId;
}
