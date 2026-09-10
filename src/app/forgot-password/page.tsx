"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type ResetRequestState } from "@/lib/auth/actions";

const initialState: ResetRequestState = { error: null, success: false };

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display italic text-2xl text-text">
          Gunita
        </Link>
        <h1 className="mt-8 font-display text-2xl font-medium text-text">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Enter your email and we&apos;ll send you a link to choose a new one.
        </p>

        {state.success ? (
          <p className="mt-6 text-sm text-text">
            If an account exists for that email, we&apos;ve sent a reset link —
            check your inbox.
          </p>
        ) : (
          <form action={action} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm text-text-muted">
              Email
              <input
                type="email"
                name="email"
                required
                className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-accent"
                placeholder="you@example.com"
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
              {pending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-text-muted">
          <Link href="/sign-in" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
