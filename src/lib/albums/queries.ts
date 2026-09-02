import { createClient } from "@/lib/supabase/server";
import { getSignedMediaUrl, getSignedMediaUrls } from "@/lib/storage/media";
import { daysUntil } from "@/lib/dates";
import type { AlbumDetail, AlbumSummary, DeletedAlbum, Role } from "./types";

/**
 * Non-deleted media count per album, for the given album ids. A separate
 * query rather than an embedded `media(count)` with a `media.deleted_at=
 * is.null` filter — that combination silently ignores the filter and
 * counts deleted rows too when run as a non-privileged (RLS-subject)
 * user, even though the identical filter works fine against the same
 * data with the service-role key. Reproduced directly against PostgREST;
 * not worth chasing further when a plain count query sidesteps it.
 */
async function countActiveMediaByAlbum(
  supabase: Awaited<ReturnType<typeof createClient>>,
  albumIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (albumIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("media")
    .select("album_id")
    .in("album_id", albumIds)
    .is("deleted_at", null);

  if (error) throw error;
  for (const row of data ?? []) {
    counts.set(row.album_id, (counts.get(row.album_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Albums the signed-in user owns or is a member of. RLS already scopes
 * this to their albums — the `.is("deleted_at", null)` here is a browse
 * filter, not a security boundary (Recently Deleted, Milestone 6, reads
 * the same table without it).
 */
export async function getAlbumsForCurrentUser(): Promise<AlbumSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("albums")
    .select(
      `
      id, title, description, type, updated_at,
      cover:media!albums_cover_media_id_fkey ( storage_path ),
      membership:album_members!inner ( role, user_id )
    `,
    )
    .eq("album_members.user_id", user.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  const rows = data ?? [];

  const coverPaths = rows
    .map((row) => row.cover?.storage_path)
    .filter((path): path is string => Boolean(path));
  const [signedUrls, itemCounts] = await Promise.all([
    getSignedMediaUrls(coverPaths),
    countActiveMediaByAlbum(supabase, rows.map((row) => row.id)),
  ]);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    cover: row.cover?.storage_path ? (signedUrls.get(row.cover.storage_path) ?? null) : null,
    itemCount: itemCounts.get(row.id) ?? 0,
    role: (row.membership[0]?.role ?? "viewer") as Role,
    updatedAt: row.updated_at.slice(0, 10),
  }));
}

/**
 * A single album with its member list, for the album detail page.
 * Returns null if it doesn't exist, is deleted, or the caller isn't a
 * member (RLS would block the row anyway — this just makes the "not
 * found" case explicit for the page to call notFound()).
 */
export async function getAlbumDetail(id: string): Promise<AlbumDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("albums")
    .select(
      `
      id, title, description, type, updated_at,
      cover:media!albums_cover_media_id_fkey ( storage_path ),
      album_members ( role, profiles ( id, email ) )
    `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const members = data.album_members
    .filter((m) => m.profiles !== null)
    .map((m) => ({
      userId: m.profiles!.id,
      email: m.profiles!.email,
      role: m.role as Role,
    }));

  const mine = members.find((m) => m.userId === user.id);
  if (!mine) return null;

  const itemCounts = await countActiveMediaByAlbum(supabase, [id]);

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    type: data.type,
    cover: await getSignedMediaUrl(data.cover?.storage_path ?? null),
    itemCount: itemCounts.get(id) ?? 0,
    role: mine.role,
    updatedAt: data.updated_at.slice(0, 10),
    members,
  };
}

/**
 * Albums the current user deleted and can still restore. Scoped to
 * owner_id, not a general membership check — only the owner can delete
 * (or restore) an album (docs/PRD.md §4/§7), so this is exactly the set
 * they're able to act on.
 */
export async function getDeletedAlbums(): Promise<DeletedAlbum[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("albums")
    .select("id, title, deleted_at, purge_at")
    .eq("owner_id", user.id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    daysLeft: daysUntil(row.purge_at!),
    deletedAt: row.deleted_at!,
  }));
}
