"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { mapAuthError, type MappedAuthError } from "@/lib/auth/identity-errors";
import {
  authCallbackUrl,
  persistAuthNextPath,
} from "@/lib/auth/oauth-redirect";
import { syncProfileSafely } from "@/lib/auth/sync-profile";
import {
  clearPendingCheckoutPack,
  getPendingCheckoutPack,
  setPendingCheckoutPack,
} from "@/lib/billing/pending-checkout";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type AuthProfile = {
  hearts: number;
  lastHeartUpdatedAt: string | null;
  isAnonymous: boolean;
  preferredLanguage: string;
};

export type LinkModalReason = "save" | "checkout";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  emailSent: boolean;
  profile: AuthProfile | null;
  authError: MappedAuthError | null;
  linkModalOpen: boolean;
  linkModalReason: LinkModalReason;
  pendingCheckoutPackId: string | null;
  isCheckingOut: boolean;
  checkoutError: string | null;
  openLinkModal: (reason?: LinkModalReason, packId?: string) => void;
  closeLinkModal: () => void;
  clearAuthError: () => void;
  clearCheckoutError: () => void;
  triggerCheckout: (packId: string) => Promise<void>;
  continueWithGoogle: (mode: "link" | "existing") => Promise<void>;
  continueWithEmail: (email: string, mode: "link" | "existing") => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<AuthProfile | null>;
  updateHearts: (hearts: number, lastHeartUpdatedAt: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function callbackUrl(): string {
  return authCallbackUrl(window.location.origin);
}

function toProfile(
  record: Record<string, unknown>,
  locale: string,
): AuthProfile {
  return {
    hearts: typeof record.hearts === "number" ? record.hearts : 5,
    lastHeartUpdatedAt:
      typeof record.last_heart_updated_at === "string"
        ? record.last_heart_updated_at
        : null,
    isAnonymous: Boolean(record.is_anonymous),
    preferredLanguage:
      typeof record.preferred_language === "string"
        ? record.preferred_language
        : locale,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const locale = useLocale();
  const pathname = usePathname();
  const [loading, setLoading] = useState(configured);
  const [emailSent, setEmailSent] = useState(false);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [authError, setAuthError] = useState<MappedAuthError | null>(() => {
    if (typeof window !== "undefined") {
      const errorParam = new URLSearchParams(window.location.search).get(
        "authError",
      );
      if (errorParam) {
        return mapAuthError({ message: errorParam });
      }
    }
    return null;
  });
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalReason, setLinkModalReason] =
    useState<LinkModalReason>("save");
  const [pendingCheckoutPackId, setPendingCheckoutPackId] = useState<
    string | null
  >(() => {
    if (typeof window !== "undefined") {
      return getPendingCheckoutPack(
        new URLSearchParams(window.location.search),
      );
    }
    return null;
  });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!configured) {
      return null;
    }
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await syncProfileSafely(supabase, locale);
    if (error) {
      const mapped = mapAuthError(error);
      if (mapped.kind !== "generic") {
        setAuthError(mapped);
      }
      return null;
    }
    if (!data || typeof data !== "object") {
      return null;
    }
    const nextProfile = toProfile(data as Record<string, unknown>, locale);
    setProfile(nextProfile);
    return nextProfile;
  }, [configured, locale]);

  const openLinkModal = useCallback(
    (reason: LinkModalReason = "save", packId?: string) => {
      setAuthError(null);
      setEmailSent(false);
      setLinkModalReason(reason);
      if (packId) {
        setPendingCheckoutPackId(packId);
        setPendingCheckoutPack(packId);
      }
      setLinkModalOpen(true);
    },
    [],
  );

  const closeLinkModal = useCallback(() => setLinkModalOpen(false), []);

  const clearAuthError = useCallback(() => setAuthError(null), []);
  const clearCheckoutError = useCallback(() => setCheckoutError(null), []);

  const triggerCheckout = useCallback(
    async (packId: string) => {
      setIsCheckingOut(true);
      setCheckoutError(null);
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
          setIsCheckingOut(false);
          return;
        }
        if (!response.ok || !payload.url) {
          setCheckoutError(payload.error || "checkout_failed");
          setIsCheckingOut(false);
          return;
        }
        clearPendingCheckoutPack();
        window.location.assign(payload.url);
      } catch {
        setCheckoutError("checkout_failed");
        setIsCheckingOut(false);
      }
    },
    [locale, openLinkModal],
  );

  useEffect(() => {
    if (!configured) {
      return;
    }

    let cancelled = false;
    const supabase = createBrowserSupabaseClient();

    async function boot() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error && !cancelled) {
          setAuthError(mapAuthError(error));
        }
      }
      if (!cancelled) {
        await refreshProfile();
        setLoading(false);
      }
    }

    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (cancelled) {
        return;
      }
      if (
        event === "SIGNED_IN" ||
        event === "USER_UPDATED" ||
        event === "TOKEN_REFRESHED"
      ) {
        await refreshProfile();
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [configured, refreshProfile]);

  useEffect(() => {
    if (!profile || profile.isAnonymous || isCheckingOut) {
      return;
    }

    const searchParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const targetPack =
      pendingCheckoutPackId || getPendingCheckoutPack(searchParams);
    if (targetPack) {
      void (async () => {
        setLinkModalOpen(false);
        setPendingCheckoutPackId(null);
        await triggerCheckout(targetPack);
      })();
    }
  }, [profile, isCheckingOut, pendingCheckoutPackId, triggerCheckout]);

  const continueWithGoogle = useCallback(
    async (mode: "link" | "existing") => {
      if (!configured) {
        return;
      }
      setAuthError(null);
      const nextPath =
        pendingCheckoutPackId && linkModalReason === "checkout"
          ? `/${locale}${pathname}?checkout=${encodeURIComponent(pendingCheckoutPackId)}`
          : `/${locale}${pathname}`;

      persistAuthNextPath(nextPath);
      const supabase = createBrowserSupabaseClient();
      const oauthOptions = {
        redirectTo: callbackUrl(),
        skipBrowserRedirect: true as const,
      };

      const { data, error } =
        mode === "existing"
          ? await (async () => {
              await supabase.auth.signOut();
              return supabase.auth.signInWithOAuth({
                provider: "google",
                options: oauthOptions,
              });
            })()
          : await supabase.auth.linkIdentity({
              provider: "google",
              options: oauthOptions,
            });

      if (error) {
        setAuthError(mapAuthError(error));
        return;
      }
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setAuthError(mapAuthError({ message: "missing oauth url" }));
    },
    [configured, linkModalReason, locale, pathname, pendingCheckoutPackId],
  );

  const continueWithEmail = useCallback(
    async (email: string, mode: "link" | "existing") => {
      if (!configured) {
        return;
      }
      setAuthError(null);
      setEmailSent(false);
      const nextPath =
        pendingCheckoutPackId && linkModalReason === "checkout"
          ? `/${locale}${pathname}?checkout=${encodeURIComponent(pendingCheckoutPackId)}`
          : `/${locale}${pathname}`;

      const supabase = createBrowserSupabaseClient();
      persistAuthNextPath(nextPath);
      if (mode === "existing") {
        await supabase.auth.signOut();
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: callbackUrl() },
        });
        if (error) {
          setAuthError(mapAuthError(error));
          return;
        }
        setEmailSent(true);
        return;
      }

      const { error } = await supabase.auth.updateUser({ email });
      if (error) {
        setAuthError(mapAuthError(error));
        return;
      }
      setEmailSent(true);
    },
    [configured, linkModalReason, locale, pathname, pendingCheckoutPackId],
  );

  const signOut = useCallback(async () => {
    if (!configured) {
      return;
    }
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    await supabase.auth.signInAnonymously();
    await refreshProfile();
  }, [configured, refreshProfile]);

  const updateHearts = useCallback(
    (hearts: number, lastHeartUpdatedAt: string) => {
      setProfile((current) =>
        current ? { ...current, hearts, lastHeartUpdatedAt } : current,
      );
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      loading,
      emailSent,
      profile,
      authError,
      linkModalOpen,
      linkModalReason,
      pendingCheckoutPackId,
      isCheckingOut,
      checkoutError,
      openLinkModal,
      closeLinkModal,
      clearAuthError,
      clearCheckoutError,
      triggerCheckout,
      continueWithGoogle,
      continueWithEmail,
      signOut,
      refreshProfile,
      updateHearts,
    }),
    [
      authError,
      checkoutError,
      clearAuthError,
      clearCheckoutError,
      closeLinkModal,
      configured,
      continueWithEmail,
      continueWithGoogle,
      emailSent,
      isCheckingOut,
      linkModalOpen,
      linkModalReason,
      loading,
      openLinkModal,
      pendingCheckoutPackId,
      profile,
      refreshProfile,
      signOut,
      triggerCheckout,
      updateHearts,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
