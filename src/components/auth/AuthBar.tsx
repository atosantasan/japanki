"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

export function AuthBar() {
  const t = useTranslations("Auth");
  const tHome = useTranslations("HomePage");
  const {
    configured,
    loading,
    emailSent,
    profile,
    authError,
    linkModalOpen,
    linkModalReason,
    checkoutConfirmPackId,
    isCheckingOut,
    openLinkModal,
    closeLinkModal,
    clearAuthError,
    confirmPendingCheckout,
    cancelPendingCheckout,
    continueWithGoogle,
    continueWithEmail,
    signOut,
  } = useAuth();
  const [email, setEmail] = useState("");

  if (!configured) {
    return null;
  }

  const title =
    linkModalReason === "checkout"
      ? t("checkoutGuard")
      : linkModalReason === "signup"
        ? t("signUp")
        : t("login");
  const body =
    linkModalReason === "signup" ? t("signUpBody") : t("loginBody");

  function dismissModal() {
    clearAuthError();
    closeLinkModal();
  }

  const confirmPackName =
    checkoutConfirmPackId === "travel"
      ? tHome("travelCta")
      : (checkoutConfirmPackId ?? "");

  const confirmModal =
    checkoutConfirmPackId && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4"
            onClick={cancelPendingCheckout}
          >
            <div
              className="w-full max-w-md rounded-3xl border border-cream/15 bg-[#1b1713] p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-semibold text-cream">
                {t("checkoutConfirmTitle")}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-cream/75">
                {t("checkoutConfirmBody", { pack: confirmPackName })}
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  disabled={isCheckingOut}
                  className="rounded-full bg-sun px-4 py-3 text-sm font-semibold text-cream disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={confirmPendingCheckout}
                >
                  {isCheckingOut
                    ? t("checkoutRedirecting")
                    : t("checkoutConfirmContinue")}
                </button>
                <button
                  type="button"
                  disabled={isCheckingOut}
                  className="rounded-full border border-cream/30 px-4 py-3 text-sm text-cream disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={cancelPendingCheckout}
                >
                  {t("checkoutConfirmCancel")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const modal =
    linkModalOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4"
            onClick={dismissModal}
          >
            <div
              className="w-full max-w-md rounded-3xl border border-cream/15 bg-[#1b1713] p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-semibold text-cream">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-cream/75">
                {body}
              </p>
              {authError ? (
                <p className="mt-3 text-sm text-sun">{t(authError.messageKey)}</p>
              ) : null}
              {emailSent ? (
                <p className="mt-3 text-sm text-cream">{t("emailSent")}</p>
              ) : null}
              <div className="mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  className="rounded-full bg-sun px-4 py-3 text-sm font-semibold text-cream"
                  onClick={() => void continueWithGoogle()}
                >
                  {t("continueGoogle")}
                </button>
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void continueWithEmail(email);
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
              <button
                type="button"
                className="mt-4 text-xs text-cream/50"
                onClick={dismissModal}
              >
                {t("stayGuest")}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="flex items-center gap-2">
        {authError && !linkModalOpen ? (
          <button
            type="button"
            onClick={() => openLinkModal("login")}
            className="text-xs text-sun underline hover:text-sun/80"
            role="alert"
          >
            {t(authError.messageKey)}
          </button>
        ) : null}
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
          <>
            <button
              type="button"
              className="rounded-full border border-cream/20 px-3 py-1 text-xs text-cream/80 hover:border-cream/50"
              onClick={() => openLinkModal("login")}
            >
              {t("login")}
            </button>
            <button
              type="button"
              className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink"
              onClick={() => openLinkModal("signup")}
            >
              {t("signUp")}
            </button>
          </>
        )}
      </div>
      {modal}
      {confirmModal}
    </>
  );
}
