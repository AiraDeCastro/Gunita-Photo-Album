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
