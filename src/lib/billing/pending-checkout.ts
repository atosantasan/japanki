const PENDING_CHECKOUT_STORAGE_KEY = "japanki_pending_checkout_pack";

export function getPendingCheckoutPack(
  searchParams?: URLSearchParams | null,
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

  try {
    const fromSession =
      window.sessionStorage?.getItem(PENDING_CHECKOUT_STORAGE_KEY);
    if (fromSession && fromSession.trim()) {
      return fromSession.trim();
    }
  } catch {
    // ignore
  }

  try {
    const fromLocal =
      window.localStorage?.getItem(PENDING_CHECKOUT_STORAGE_KEY);
    if (fromLocal && fromLocal.trim()) {
      return fromLocal.trim();
    }
  } catch {
    // ignore
  }

  return null;
}

export function setPendingCheckoutPack(packId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage?.setItem(PENDING_CHECKOUT_STORAGE_KEY, packId);
  } catch {
    // ignore quota or disabled storage
  }
  try {
    window.localStorage?.setItem(PENDING_CHECKOUT_STORAGE_KEY, packId);
  } catch {
    // ignore quota or disabled storage
  }
}

export function clearPendingCheckoutPack(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage?.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    window.localStorage?.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
