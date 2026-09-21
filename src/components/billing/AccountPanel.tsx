"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  ACCOUNT_DELETION_CONFIRM_TEXT,
  canConfirmAccountDeletion,
} from "@/lib/account/deletion";
import { clearPendingCheckoutPack } from "@/lib/billing/pending-checkout";
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
  const router = useRouter();
  const { profile, loading, openLinkModal, signOut } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [portalError, setPortalError] = useState<
    "noCustomer" | "error" | null
  >(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  useEffect(() => {
    if (!profile) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
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
      } catch {
        if (!cancelled) {
          setLoadError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  async function openPortal() {
    setPortalBusy(true);
    setPortalError(null);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: string;
      };
      setPortalBusy(false);
      if (
        response.status === 403 &&
        payload.error === "identity_linking_required"
      ) {
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
    } catch {
      setPortalBusy(false);
      setPortalError("error");
    }
  }

  async function exportData() {
    setExportBusy(true);
    setExportError(false);
    try {
      const response = await fetch("/api/account/export", {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) {
        setExportError(true);
        setExportBusy(false);
        return;
      }
      const blob = await response.blob();
      const header = response.headers.get("Content-Disposition");
      const matched = header?.match(/filename="([^"]+)"/);
      const filename = matched?.[1] ?? "japanki-export.json";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportBusy(false);
    } catch {
      setExportError(true);
      setExportBusy(false);
    }
  }

  async function deleteAccount() {
    if (!canConfirmAccountDeletion(deleteConfirm)) {
      return;
    }
    setDeleteBusy(true);
    setDeleteError(false);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!response.ok) {
        setDeleteError(true);
        setDeleteBusy(false);
        return;
      }
      clearPendingCheckoutPack();
      try {
        await signOut();
      } catch {
        // Session may already be invalid after deleteUser.
      }
      router.replace("/");
    } catch {
      setDeleteError(true);
      setDeleteBusy(false);
    }
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

      <section className="mt-12 border-t border-cream/15 pt-8">
        <h2 className="text-2xl font-semibold text-cream">{t("privacyTitle")}</h2>
        <p className="mt-3 max-w-xl text-cream/75">{t("privacyBody")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void exportData()}
            disabled={exportBusy || deleteBusy}
            className="inline-flex rounded-full bg-cream px-6 py-3 text-sm font-semibold text-ink"
          >
            {exportBusy ? t("exporting") : t("exportData")}
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteOpen(true);
              setDeleteError(false);
            }}
            disabled={exportBusy || deleteBusy}
            className="inline-flex rounded-full border border-sun/60 px-6 py-3 text-sm font-semibold text-sun"
          >
            {t("deleteAccount")}
          </button>
        </div>
        {exportError ? (
          <p className="mt-4 text-sm text-sun">{t("exportError")}</p>
        ) : null}
        {deleteOpen ? (
          <div className="mt-6 max-w-xl rounded-2xl border border-sun/40 bg-sun/10 px-5 py-4">
            <p className="text-cream/90">{t("deleteWarning")}</p>
            <label className="mt-4 block text-sm text-cream/75">
              {t("deleteConfirmLabel", { confirm: ACCOUNT_DELETION_CONFIRM_TEXT })}
              <input
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                className="mt-2 w-full rounded-xl border border-cream/20 bg-ink px-4 py-2 text-cream"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={
                  deleteBusy || !canConfirmAccountDeletion(deleteConfirm)
                }
                className="inline-flex rounded-full bg-sun px-5 py-2 text-sm font-semibold text-ink disabled:opacity-40"
              >
                {deleteBusy ? t("deleting") : t("deleteConfirm")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirm("");
                  setDeleteError(false);
                }}
                disabled={deleteBusy}
                className="inline-flex rounded-full border border-cream/30 px-5 py-2 text-sm font-semibold text-cream"
              >
                {t("deleteCancel")}
              </button>
            </div>
            {deleteError ? (
              <p className="mt-3 text-sm text-sun">{t("deleteError")}</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
