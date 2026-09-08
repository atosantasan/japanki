"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

export function PurchaseButton({ packId }: { packId: string }) {
  const tHome = useTranslations("HomePage");
  const tAuth = useTranslations("Auth");
  const locale = useLocale();
  const {
    openLinkModal,
    isCheckingOut: globalCheckingOut,
    checkoutError: globalCheckoutError,
  } = useAuth();
  const [localBusy, setLocalBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isBusy = localBusy || globalCheckingOut;
  const checkoutError = localError || globalCheckoutError;

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
      };
      if (
        response.status === 403 &&
        payload.error === "identity_linking_required"
      ) {
        openLinkModal("checkout", packId);
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
          {checkoutError === "checkout_failed"
            ? tAuth("checkoutError")
            : checkoutError}
        </p>
      ) : null}
    </div>
  );
}
