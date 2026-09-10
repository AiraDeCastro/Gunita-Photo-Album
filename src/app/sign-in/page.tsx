"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, type AuthState } from "@/lib/auth/actions";

const initialState: AuthState = { error: null };

export default function SignInPage() {
  // useSearchParams needs a Suspense boundary even though this route has
  // no other async data — without it, Next can't statically render the
  // parts of the page that don't depend on the query string.
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"sign-in" | "sign-up">(
    searchParams.get("mode") === "sign-up" ? "sign-up" : "sign-in",
  );
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState,
  );

  const isSignIn = mode === "sign-in";
  const state = isSignIn ? signInState : signUpState;
  const pending = isSignIn ? signInPending : signUpPending;
  const action = isSignIn ? signInAction : signUpAction;

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display italic text-2xl text-text">
          Gunita
        </Link>
        <div className="mt-8 flex rounded-md border border-border p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("sign-in")}
            className={`flex-1 rounded px-3 py-1.5 transition-colors ${
              mode === "sign-in" ? "bg-accent text-accent-ink" : "text-text-muted"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("sign-up")}
            className={`flex-1 rounded px-3 py-1.5 transition-colors ${
              mode === "sign-up" ? "bg-accent text-accent-ink" : "text-text-muted"
            }`}
          >
            Sign up
          </button>
        </div>

        <form key={mode} action={action} className="mt-6 flex flex-col gap-4">
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
          <label className="flex flex-col gap-1.5 text-sm text-text-muted">
            Password
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-accent"
              placeholder="At least 8 characters"
            />
          </label>
          {isSignIn && (
            <Link href="/forgot-password" className="text-xs text-accent hover:underline self-end">
              Forgot password?
            </Link>
          )}
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
            {pending
              ? isSignIn
                ? "Signing in…"
                : "Creating account…"
              : isSignIn
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
