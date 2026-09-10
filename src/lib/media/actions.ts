"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Soft-delete: moves into the 30-day Recently Deleted window (PRD §7). */
export async function deleteMedia(albumId: string, mediaId: string) {
  const supabase = await createClient();
  const purgeAt = new Date();
  purgeAt.setDate(purgeAt.getDate() + 30);

  const { error } = await supabase
    .from("media")
    .update({ deleted_at: new Date().toISOString(), purge_at: purgeAt.toISOString() })
    .eq("id", mediaId)
    .eq("album_id", albumId);

  if (error) throw new Error(error.message);

  // If this was the album's cover, clear it — the query layer will just
  // treat a null cover as "no photos yet" until something else is set.
  await supabase
    .from("albums")
    .update({ cover_media_id: null })
    .eq("id", albumId)
    .eq("cover_media_id", mediaId);

  revalidatePath(`/album/${albumId}`);
  revalidatePath("/");
}

/**
 * Persists a drag-to-reorder: `orderedMediaIds` is the full grid in its
 * new visual order, and each item's `sort_order` becomes its index in
 * that array — a clean 0..n-1 resequencing rather than nudging individual
 * rows, so any gaps left by `sortOrder = min - 1` inserts (see the upload
 * route) get reset too. Same "owner/admin/editor can edit media" RLS
 * policy as every other media mutation; no new policy needed since it's
 * just another column on an already-allowed UPDATE.
 */
export async function reorderMedia(albumId: string, orderedMediaIds: string[]) {
  const supabase = await createClient();

  const results = await Promise.all(
    orderedMediaIds.map((mediaId, index) =>
      supabase.from("media").update({ sort_order: index }).eq("id", mediaId).eq("album_id", albumId),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  revalidatePath(`/album/${albumId}`);
}

/** Same role check as delete — owner/admin/editor, via the "edit media" RLS policy. */
export async function restoreMedia(albumId: string, mediaId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("media")
    .update({ deleted_at: null, purge_at: null })
    .eq("id", mediaId)
    .eq("album_id", albumId);

  if (error) throw new Error(error.message);

  revalidatePath("/recently-deleted");
  revalidatePath(`/album/${albumId}`);
  revalidatePath("/");
}
