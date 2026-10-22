import { isSupabaseConfigured } from "@/lib/supabase/config";

export const authConfigured = isSupabaseConfigured();

export const googleAuthEnabled =
  authConfigured &&
  process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED === "true";
