"use client";

import { useState, useTransition } from "react";
import { deleteAlbum } from "@/lib/albums/actions";

export default function DeleteAlbumButton({
  albumId,
  albumTitle,
}: {
  albumId: string;
  albumTitle: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-muted">Delete “{albumTitle}”?</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => deleteAlbum(albumId))}
          className="rounded-md bg-danger px-3 py-2 text-sm font-medium text-danger-ink hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-sm text-text-muted hover:text-text transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-md border border-accent px-4 py-2 text-sm text-accent hover:bg-accent-soft transition-colors"
    >
      Delete album
    </button>
  );
}
