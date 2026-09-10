"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { updatePassword, type AuthState } from "@/lib/auth/actions";

const initialState: AuthState = { error: null };

/**
 * Arrived at via the emailed reset link, whose recovery tokens ride in the
 * URL hash (never sent to the server) — the Supabase browser client
 * exchanges them for a real session on mount. `getSession()` is safe to
 * call immediately: it internally waits for that exchange to finish before
 * resolving, so there's no race between "page rendered" and "session
 * actually established" to worry about here.
 */
export default function ResetPasswordPage() {
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [state, action, pending] = useActionState(updatePassword, initialState);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setStatus(session ? "ready" : "invalid");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) setStatus("ready");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-16 text-sm text-text-muted">
        Verifying your link…
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-text">This link is invalid or has expired.</p>
        <Link href="/forgot-password" className="text-sm text-accent hover:underline">
          Request a new one
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display italic text-2xl text-text">
          Gunita
        </Link>
        <h1 className="mt-8 font-display text-2xl font-medium text-text">
          Choose a new password
        </h1>

        <form action={action} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-text-muted">
            New password
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-accent"
              placeholder="At least 8 characters"
            />
          </label>
          {state.error && (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
