import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncProfileRow = {
  id: string;
  is_anonymous: boolean;
  preferred_language: string;
  hearts: number;
  last_heart_updated_at: string | null;
};

export type SyncProfileResult = {
  data: SyncProfileRow | null;
  error: unknown | null;
};

function isParameterMismatchError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { code?: string; message?: string; status?: number };
  if (err.code === "PGRST202" || err.code === "PGRST203") {
    return true;
  }
  const message = String(err.message ?? "").toLowerCase();
  return (
    message.includes("could not find the function") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("matches the given name")
  );
}

export async function syncProfileSafely(
  supabase: Pick<SupabaseClient, "auth" | "rpc">,
  locale?: string,
): Promise<SyncProfileResult> {
  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    const session = sessionData?.session;

    if (sessionError || !session?.access_token || !session?.user) {
      return { data: null, error: null };
    }

    const params = locale ? { preferred_language_param: locale } : {};
    let data: unknown = null;
    let rpcError: unknown = null;

    try {
      const response = await supabase.rpc("sync_profile", params);
      data = response.data;
      rpcError = response.error;
    } catch (callErr) {
      rpcError = callErr;
    }

    if (rpcError && isParameterMismatchError(rpcError) && locale) {
      try {
        const fallback = await supabase.rpc("sync_profile", {});
        data = fallback.data;
        rpcError = fallback.error;
      } catch (fallbackErr) {
        rpcError = fallbackErr;
      }
    }

    if (rpcError) {
      console.warn("sync_profile safely bypassed error:", rpcError);
      return { data: null, error: null };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") {
      return { data: null, error: null };
    }

    return { data: row as SyncProfileRow, error: null };
  } catch (err) {
    console.warn("syncProfileSafely caught exception:", err);
    return { data: null, error: null };
  }
}
