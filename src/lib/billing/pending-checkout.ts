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

  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }

  try {
    const stored = window.sessionStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY);
    return stored && stored.trim() ? stored.trim() : null;
  } catch {
    return null;
  }
}

export function setPendingCheckoutPack(packId: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }
  try {
    window.sessionStorage.setItem(PENDING_CHECKOUT_STORAGE_KEY, packId);
  } catch {
    // ignore quota or disabled storage
  }
}

export function clearPendingCheckoutPack(): void {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }
  try {
    window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
