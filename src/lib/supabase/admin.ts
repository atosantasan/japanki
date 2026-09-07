import { createClient } from "@supabase/supabase-js";
import {
  getSupabasePublicConfig,
  getSupabaseSecretKey,
} from "@/lib/supabase/config";

export function createAdminSupabaseClient() {
  const { url } = getSupabasePublicConfig();
  const secretKey = getSupabaseSecretKey();

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
