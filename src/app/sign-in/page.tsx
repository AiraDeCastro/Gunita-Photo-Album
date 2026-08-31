"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignInPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

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

        <form className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-text-muted">
            Email
            <input
              type="email"
              required
              className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-accent"
              placeholder="you@example.com"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-text-muted">
            Password
            <input
              type="password"
              required
              minLength={8}
              className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-accent"
              placeholder="At least 8 characters"
            />
          </label>
          {mode === "sign-in" && (
            <Link href="/" className="text-xs text-accent hover:underline self-end">
              Forgot password?
            </Link>
          )}
          <button
            type="submit"
            className="mt-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90 transition-opacity"
          >
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
