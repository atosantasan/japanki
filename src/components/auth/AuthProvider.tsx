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
  openLinkModal: (reason?: LinkModalReason) => void;
  closeLinkModal: () => void;
  clearAuthError: () => void;
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
  const [authError, setAuthError] = useState<MappedAuthError | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalReason, setLinkModalReason] =
    useState<LinkModalReason>("save");

  const nextPath = `/${locale}${pathname}`;

  const refreshProfile = useCallback(async () => {
    if (!configured) {
      return null;
    }
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.rpc("sync_profile", {
      preferred_language_param: locale,
    });
    if (error) {
      setAuthError(mapAuthError(error));
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") {
      return null;
    }
    const nextProfile = toProfile(row as Record<string, unknown>, locale);
    setProfile(nextProfile);
    return nextProfile;
  }, [configured, locale]);

  useEffect(() => {
    if (!configured) {
      return;
    }

    let cancelled = false;

    async function boot() {
      const supabase = createBrowserSupabaseClient();
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
    return () => {
      cancelled = true;
    };
  }, [configured, refreshProfile]);

  const continueWithGoogle = useCallback(
    async (mode: "link" | "existing") => {
      if (!configured) {
        return;
      }
      setAuthError(null);
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
        console.error("Google auth failed", error);
        setAuthError(mapAuthError(error));
        return;
      }
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      console.error("Google auth failed: missing oauth url");
      setAuthError(mapAuthError({ message: "missing oauth url" }));
    },
    [configured, nextPath],
  );

  const continueWithEmail = useCallback(
    async (email: string, mode: "link" | "existing") => {
      if (!configured) {
        return;
      }
      setAuthError(null);
      setEmailSent(false);
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
    [configured, nextPath],
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

  const openLinkModal = useCallback(
    (reason: LinkModalReason = "save") => {
      setAuthError(null);
      setEmailSent(false);
      setLinkModalReason(reason);
      setLinkModalOpen(true);
    },
    [],
  );

  const closeLinkModal = useCallback(() => setLinkModalOpen(false), []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

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
      openLinkModal,
      closeLinkModal,
      clearAuthError,
      continueWithGoogle,
      continueWithEmail,
      signOut,
      refreshProfile,
      updateHearts,
    }),
    [
      authError,
      clearAuthError,
      closeLinkModal,
      configured,
      continueWithEmail,
      continueWithGoogle,
      emailSent,
      linkModalOpen,
      linkModalReason,
      loading,
      openLinkModal,
      profile,
      refreshProfile,
      signOut,
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
