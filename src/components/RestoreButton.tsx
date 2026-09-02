"use client";

import { useTransition } from "react";
import { restoreAlbum } from "@/lib/albums/actions";
import { restoreMedia } from "@/lib/media/actions";

type Props =
  | { kind: "album"; id: string }
  | { kind: "media"; id: string; albumId: string };

export default function RestoreButton(props: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() =>
          props.kind === "album" ? restoreAlbum(props.id) : restoreMedia(props.albumId, props.id),
        )
      }
      className="rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-sunken transition-colors disabled:opacity-60"
    >
      {pending ? "Restoring…" : "Restore"}
    </button>
  );
}
