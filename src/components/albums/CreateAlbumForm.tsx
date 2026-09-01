"use client";

import { useActionState, useState } from "react";
import { createAlbum, type ActionState } from "@/lib/albums/actions";

const initialState: ActionState = { error: null };

export default function CreateAlbumForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAlbum, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-sunken transition-colors"
      >
        + New album
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        name="title"
        autoFocus
        required
        placeholder="Album title"
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-text-muted hover:text-text transition-colors"
        >
          Cancel
        </button>
      </div>
      {state.error && (
        <p className="text-sm text-danger sm:basis-full" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
