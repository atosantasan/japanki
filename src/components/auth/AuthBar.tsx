"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

export function AuthBar() {
  const t = useTranslations("Auth");
  const {
    configured,
    loading,
    emailSent,
    profile,
    authError,
    linkModalOpen,
    linkModalReason,
    openLinkModal,
    closeLinkModal,
    clearAuthError,
    continueWithGoogle,
    continueWithEmail,
    signOut,
  } = useAuth();
  const [email, setEmail] = useState("");

  if (!configured) {
    return null;
  }

  const collision = authError?.kind === "identity_collision";
  const title =
    collision
      ? t("collisionTitle")
      : linkModalReason === "checkout"
        ? t("checkoutGuard")
        : t("saveProgress");

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs tracking-wide text-cream/70 sm:inline">
          {loading
            ? "…"
            : profile?.isAnonymous === false
              ? t("linked")
              : t("guest")}
        </span>
        {profile?.isAnonymous === false ? (
          <button
            type="button"
            className="rounded-full border border-cream/20 px-3 py-1 text-xs text-cream/80 hover:border-cream/50"
            onClick={() => void signOut()}
          >
            {t("signOut")}
          </button>
        ) : (
          <button
            type="button"
            className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink"
            onClick={() => openLinkModal("save")}
          >
            {t("saveProgress")}
          </button>
        )}
      </div>

      {linkModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4">
          <div className="w-full max-w-md rounded-3xl border border-cream/15 bg-[#1b1713] p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-cream">{title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-cream/75">
              {collision ? t("collisionBody") : t("continueEmail")}
            </p>
            {authError && !collision ? (
              <p className="mt-3 text-sm text-sun">{t(authError.messageKey)}</p>
            ) : null}
            {emailSent ? (
              <p className="mt-3 text-sm text-cream">{t("emailSent")}</p>
            ) : null}
            {!collision ? (
              <div className="mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  className="rounded-full bg-sun px-4 py-3 text-sm font-semibold text-cream"
                  onClick={() => void continueWithGoogle("link")}
                >
                  {t("continueGoogle")}
                </button>
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void continueWithEmail(email, "link");
                  }}
                >
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className="rounded-full border border-cream/20 bg-transparent px-4 py-3 text-sm text-cream outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-cream/30 px-4 py-3 text-sm font-semibold text-cream"
                  >
                    {t("sendLink")}
                  </button>
                </form>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  className="rounded-full bg-sun px-4 py-3 text-sm font-semibold text-cream"
                  onClick={() => void continueWithGoogle("existing")}
                >
                  {t("useExisting")}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-cream/30 px-4 py-3 text-sm text-cream"
                  onClick={() => {
                    clearAuthError();
                    closeLinkModal();
                  }}
                >
                  {t("stayGuest")}
                </button>
              </div>
            )}
            {!collision ? (
              <button
                type="button"
                className="mt-4 text-xs text-cream/50"
                onClick={() => {
                  clearAuthError();
                  closeLinkModal();
                }}
              >
                {t("stayGuest")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
