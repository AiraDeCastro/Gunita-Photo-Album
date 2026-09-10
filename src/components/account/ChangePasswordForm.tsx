"use client";

import { useActionState, useState } from "react";
import { updatePassword, type AuthState } from "@/lib/auth/actions";

const initialState: AuthState = { error: null };

export default function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updatePassword, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-sunken transition-colors"
      >
        Change password
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm text-text-muted">
        New password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoFocus
          className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-accent"
          placeholder="At least 8 characters"
        />
      </label>
      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-sunken transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
