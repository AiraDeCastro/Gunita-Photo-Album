"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null };
export type ResetRequestState = { error: string | null; success: boolean };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function validate(email: string, password: string): string | null {
  if (!email || !password) return "Email and password are required.";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export async function signIn(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const validationError = validate(email, password);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/");
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const validationError = validate(email, password);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  redirect("/");
}

/**
 * Always reports success regardless of whether the email actually belongs
 * to an account — Supabase itself doesn't reveal that (a real error here
 * only ever means something like rate-limiting, not "no such user"), and
 * echoing that distinction back to the caller would let anyone enumerate
 * registered emails through this form.
 */
export async function requestPasswordReset(
  _prevState: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address.", success: false };
  }

  const supabase = await createClient();
  // Server Actions are invoked via fetch, which always carries an Origin
  // header — safe to rely on instead of a hardcoded/env-configured site
  // URL, and it's automatically correct in every environment (localhost,
  // preview deploys, production) without extra config.
  const origin =
    (await headers()).get("origin") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });
  if (error) return { error: error.message, success: false };

  return { error: null, success: true };
}

/**
 * Used both by /reset-password (after a recovery-link session is
 * established — see the middleware comment on PUBLIC_ROUTES) and by the
 * Account page's "Change password" (an already signed-in user). Either
 * way this just needs a valid session, which `createClient()` already
 * reads from cookies — no separate recovery-vs-normal-session branching.
 */
export async function updatePassword(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
