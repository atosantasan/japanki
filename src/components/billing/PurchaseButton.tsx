"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "@/i18n/navigation";
import { isPackOwned } from "@/lib/billing/user-packs";
import { UNLIMITED_HEARTS_PRODUCT_ID } from "@/lib/constants/app";

const textActionClass =
  "text-left text-base font-medium text-cream/80 underline decoration-cream/25 underline-offset-[0.3em] outline-none hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream disabled:cursor-not-allowed disabled:opacity-50";

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
        className={textActionClass}
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
        className={textActionClass}
      >
        {isBusy ? tAuth("checkoutRedirecting") : tHome("buyTravel")}
      </button>
      {checkoutError ? (
        <p className="max-w-sm text-sm leading-relaxed text-cream/80" role="alert">
          {checkoutErrorMessage(checkoutError)}
        </p>
      ) : null}
    </div>
  );
}

export function UnlimitedHeartsButton() {
  const tHome = useTranslations("HomePage");
  const tAuth = useTranslations("Auth");
  const locale = useLocale();
  const {
    openLinkModal,
    isCheckingOut: globalCheckingOut,
    checkoutError: globalCheckoutError,
    hasUnlimitedHearts,
    refreshProfile,
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
        body: JSON.stringify({
          productId: UNLIMITED_HEARTS_PRODUCT_ID,
          locale,
        }),
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
        openLinkModal("checkout", UNLIMITED_HEARTS_PRODUCT_ID);
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

  if (hasUnlimitedHearts) {
    return (
      <p className="text-base text-cream/70">
        {tHome("unlimitedOwned")}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={isBusy}
        onClick={() => void startCheckout()}
        className={textActionClass}
      >
        {isBusy ? tAuth("checkoutRedirecting") : tHome("buyUnlimitedHearts")}
      </button>
      {checkoutError ? (
        <p className="max-w-sm text-sm leading-relaxed text-cream/80" role="alert">
          {checkoutError === "already_purchased" ||
          checkoutError === "既に購入済みのパックです"
            ? tAuth("alreadyPurchased")
            : checkoutError}
        </p>
      ) : null}
    </div>
  );
}
