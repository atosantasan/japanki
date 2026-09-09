"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { isPackOwned } from "@/lib/billing/user-packs";

export function PurchaseButton({ packId }: { packId: string }) {
  const tHome = useTranslations("HomePage");
  const tAuth = useTranslations("Auth");
  const locale = useLocale();
  const {
    openLinkModal,
    isCheckingOut: globalCheckingOut,
    checkoutError: globalCheckoutError,
    ownedPackIds,
    refreshProfile,
  } = useAuth();
  const [localBusy, setLocalBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isBusy = localBusy || globalCheckingOut;
  const checkoutError = localError || globalCheckoutError;
  const isOwned = isPackOwned(ownedPackIds, packId);

  function checkoutErrorMessage(error: string): string {
    if (
      error === "checkout_failed" ||
      error === "already_purchased" ||
      error === "既に購入済みのパックです"
    ) {
      return error === "already_purchased" ||
        error === "既に購入済みのパックです"
        ? tAuth("alreadyPurchased")
        : tAuth("checkoutError");
    }
    return error;
  }

  async function startCheckout() {
    setLocalBusy(true);
    setLocalError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, locale }),
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: string;
        code?: string;
      };
      if (
        response.status === 403 &&
        payload.error === "identity_linking_required"
      ) {
        openLinkModal("checkout", packId);
        setLocalBusy(false);
        return;
      }
      if (
        response.status === 400 &&
        (payload.code === "already_purchased" ||
          payload.error === "already_purchased" ||
          payload.error === "既に購入済みのパックです")
      ) {
        await refreshProfile();
        setLocalError(tAuth("alreadyPurchased"));
        setLocalBusy(false);
        return;
      }
      if (!response.ok || !payload.url) {
        setLocalError(payload.error || tAuth("checkoutError"));
        setLocalBusy(false);
        return;
      }
      window.location.assign(payload.url);
    } catch {
      setLocalError(tAuth("checkoutError"));
      setLocalBusy(false);
    }
  }

  if (isOwned) {
    return (
      <Link
        href={`/quiz/${packId}`}
        className="inline-flex w-fit items-center rounded-full border border-cream/30 px-6 py-3 text-sm font-semibold tracking-wide text-cream hover:border-cream/60"
      >
        {tHome("playOwned")}
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={isBusy}
        onClick={() => void startCheckout()}
        className="inline-flex w-fit items-center rounded-full border border-cream/30 px-6 py-3 text-sm font-semibold tracking-wide text-cream hover:border-cream/60 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBusy ? tAuth("checkoutRedirecting") : tHome("buyTravel")}
      </button>
      {checkoutError ? (
        <p className="text-xs text-sun" role="alert">
          {checkoutErrorMessage(checkoutError)}
        </p>
      ) : null}
    </div>
  );
}
