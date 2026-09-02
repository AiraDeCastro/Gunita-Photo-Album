import { createClient } from "@/lib/supabase/server";
import { getSignedMediaUrls } from "@/lib/storage/media";
import { daysUntil } from "@/lib/dates";
import type { DeletedMediaItem, MediaItem } from "./types";

/** Media for one album's grid. RLS scopes this to members; not deleted. */
export async function getAlbumMedia(albumId: string): Promise<MediaItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("media")
    .select(
      "id, kind, storage_path, thumbnail_storage_path, width, height, duration_seconds, bytes, created_at",
    )
    .eq("album_id", albumId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = data ?? [];

  const allPaths = rows.flatMap((row) =>
    [row.storage_path, row.thumbnail_storage_path].filter((p): p is string => Boolean(p)),
  );
  const signedUrls = await getSignedMediaUrls(allPaths);

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    url: signedUrls.get(row.storage_path) ?? null,
    thumbnailUrl: row.thumbnail_storage_path
      ? (signedUrls.get(row.thumbnail_storage_path) ?? null)
      : null,
    width: row.width,
    height: row.height,
    durationSeconds: row.duration_seconds,
    bytes: row.bytes,
    createdAt: row.created_at,
  }));
}

/**
 * Media the current user uploaded and deleted, still restorable. Scoped
 * to uploader_id — "Recently Deleted" is a personal view of what's
 * yours, the same way the storage-usage bar is (src/lib/storage/quota.ts).
 * Any owner/admin/editor of the album could restore it too via RLS, but
 * this page only surfaces what you uploaded yourself.
 */
export async function getDeletedMedia(): Promise<DeletedMediaItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("media")
    .select("id, album_id, kind, deleted_at, purge_at, albums!media_album_id_fkey ( title )")
    .eq("uploader_id", user.id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    albumId: row.album_id,
    albumTitle: row.albums?.title ?? "Deleted album",
    kind: row.kind,
    daysLeft: daysUntil(row.purge_at!),
    deletedAt: row.deleted_at!,
  }));
}
