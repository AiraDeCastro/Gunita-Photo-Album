import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Privileged Supabase client using the secret key — bypasses RLS entirely.
 *
 * Server-only. Never import this from a Client Component or expose its
 * result to the browser. Reserved for operations RLS can't express by
 * design (e.g. the Recently Deleted purge job) — everyday reads/writes
 * should go through `server.ts` so RLS stays the actual enforcement,
 * not something routes remember to check themselves.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
