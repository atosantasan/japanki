"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { SupportedLocale } from "@/lib/i18n/locales";

type PurchaseRow = {
  pack_id: string;
  created_at: string | null;
  content_packs:
    | { title: Record<string, string> | null }
    | { title: Record<string, string> | null }[]
    | null;
};

function packTitle(row: PurchaseRow, locale: SupportedLocale): string {
  const pack = Array.isArray(row.content_packs)
    ? row.content_packs[0]
    : row.content_packs;
  const title = pack?.title;
  if (title && typeof title === "object") {
    return title[locale] || title.en || row.pack_id;
  }
  return row.pack_id;
}

export function AccountPanel() {
  const t = useTranslations("Account");
  const locale = useLocale() as SupportedLocale;
  const { profile, loading, openLinkModal } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [portalError, setPortalError] = useState<
    "noCustomer" | "error" | null
  >(null);
  const [portalBusy, setPortalBusy] = useState(false);

  useEffect(() => {
    if (!profile) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from("user_purchases")
        .select("pack_id, created_at, content_packs(title)")
        .order("created_at", { ascending: false });
      if (cancelled) {
        return;
      }
      if (error) {
        setLoadError(true);
        return;
      }
      setLoadError(false);
      setPurchases((data as PurchaseRow[] | null) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  async function openPortal() {
    setPortalBusy(true);
    setPortalError(null);
    const response = await fetch("/api/billing/portal", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    const payload = (await response.json()) as { url?: string; error?: string };
    setPortalBusy(false);
    if (response.status === 403 && payload.error === "identity_linking_required") {
      openLinkModal("checkout");
      return;
    }
    if (response.status === 404 || payload.error === "no_customer") {
      setPortalError("noCustomer");
      return;
    }
    if (!response.ok || !payload.url) {
      setPortalError("error");
      return;
    }
    window.location.assign(payload.url);
  }

  if (loading) {
    return null;
  }

  if (!profile) {
    return <p className="mt-8 text-lg text-cream/75">{t("signInRequired")}</p>;
  }

  return (
    <div className="mt-10">
      {loadError ? (
        <p className="text-cream/75">{t("error")}</p>
      ) : purchases.length === 0 ? (
        <p className="text-lg text-cream/75">{t("empty")}</p>
      ) : (
        <ul className="space-y-4">
          {purchases.map((row) => (
            <li
              key={row.pack_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cream/15 bg-cream/5 px-5 py-4"
            >
              <div>
                <p className="text-lg text-cream">{packTitle(row, locale)}</p>
                {row.created_at ? (
                  <p className="mt-1 text-sm text-cream/55">
                    {t("purchasedAt", {
                      date: new Date(row.created_at).toLocaleDateString(locale),
                    })}
                  </p>
                ) : null}
              </div>
              <Link
                href={`/quiz/${row.pack_id}`}
                className="rounded-full bg-cream px-4 py-2 text-sm font-semibold text-ink"
              >
                {t("openPack")}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => void openPortal()}
        disabled={portalBusy}
        className="mt-8 inline-flex rounded-full border border-cream/30 px-6 py-3 text-sm font-semibold text-cream hover:border-cream/60"
      >
        {t("manageBilling")}
      </button>
      {portalError ? (
        <p className="mt-4 text-sm text-sun">{t(portalError)}</p>
      ) : null}
    </div>
  );
}
