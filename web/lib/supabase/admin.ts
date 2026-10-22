import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  getSupabasePublicConfig,
  getSupabaseSecretKey
} from "@/lib/supabase/config";

export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicConfig();

  return createClient(url, getSupabaseSecretKey(), {
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)])
          : AbortSignal.timeout(10_000)
      })
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
