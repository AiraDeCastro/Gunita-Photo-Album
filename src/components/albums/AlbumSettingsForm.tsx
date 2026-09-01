"use client";

import { useActionState } from "react";
import { updateAlbumDetails, type ActionState } from "@/lib/albums/actions";

const initialState: ActionState = { error: null };

export default function AlbumSettingsForm({
  albumId,
  title,
  description,
  canEdit,
}: {
  albumId: string;
  title: string;
  description: string | null;
  canEdit: boolean;
}) {
  const boundAction = updateAlbumDetails.bind(null, albumId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  if (!canEdit) {
    return (
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-medium text-text">{title}</h1>
        {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input
        type="text"
        name="title"
        defaultValue={title}
        required
        aria-label="Album title"
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
        className="-ml-0.5 border-b border-transparent bg-transparent px-0.5 font-display text-3xl font-medium text-text outline-none focus:border-accent md:text-4xl"
      />
      <input
        type="text"
        name="description"
        defaultValue={description ?? ""}
        placeholder="Add a description…"
        aria-label="Album description"
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
        className="-ml-0.5 border-b border-transparent bg-transparent px-0.5 text-sm text-text-muted outline-none focus:border-accent"
      />
      <button type="submit" className="sr-only">
        Save
      </button>
      <div className="h-4">
        {pending && (
          <span className="font-mono text-xs text-text-faint">Saving…</span>
        )}
        {state.error && (
          <span className="text-xs text-danger" role="alert">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
