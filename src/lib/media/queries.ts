import { createClient } from "@/lib/supabase/server";
import { getSignedMediaUrls } from "@/lib/storage/media";
import type { MediaItem } from "./types";

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
