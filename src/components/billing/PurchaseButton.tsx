"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

export function PurchaseButton({ packId }: { packId: string }) {
  const t = useTranslations("HomePage");
  const locale = useLocale();
  const { openLinkModal } = useAuth();

  async function startCheckout() {
    const response = await fetch("/api/checkout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId, locale }),
    });
    const payload = (await response.json()) as { url?: string; error?: string };
    if (response.status === 403 && payload.error === "identity_linking_required") {
      openLinkModal("checkout");
      return;
    }
    if (!response.ok || !payload.url) {
      return;
    }
    window.location.assign(payload.url);
  }

  return (
    <button
      type="button"
      onClick={() => void startCheckout()}
      className="inline-flex w-fit items-center rounded-full border border-cream/30 px-6 py-3 text-sm font-semibold tracking-wide text-cream hover:border-cream/60"
    >
      {t("buyTravel")}
    </button>
  );
}
