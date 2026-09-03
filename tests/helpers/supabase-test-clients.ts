import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Plain (non-Next.js) Supabase clients for integration tests, talking to
 * the same local stack `npm run dev` uses (see CLAUDE.md's "Local backend"
 * section — `supabase start` must be running). Session state lives only in
 * memory (`persistSession: false`), so a fresh client per test user is
 * cheap and never touches disk or a browser storage API that doesn't exist
 * in Node.
 */

export function adminClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function anonClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export type TestUser = { id: string; email: string; client: SupabaseClient<Database> };

/** Creates a real, confirmed auth user and returns a client already signed in as them. */
export async function createTestUser(label: string): Promise<TestUser> {
  const admin = adminClient();
  const email = `gunita-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "test-password-123";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Failed to create test user: ${error?.message}`);

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Failed to sign in test user: ${signInError.message}`);

  return { id: data.user.id, email, client };
}

/** Deletes the auth user; FK cascades (profiles → albums/album_members/media) clean up the rest. */
export async function deleteTestUser(userId: string): Promise<void> {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}

/** True if the local Supabase REST endpoint is reachable, so the suite can skip with a clear reason instead of failing opaquely when it isn't running. */
export async function isSupabaseReachable(): Promise<boolean> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return false;
    const res = await fetch(`${url}/auth/v1/health`);
    return res.ok;
  } catch {
    return false;
  }
}
