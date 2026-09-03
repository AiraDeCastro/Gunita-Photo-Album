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

/** Most recent (non-deleted) upload timestamp per album, if any. */
async function getLatestUploadByAlbum(
  supabase: Awaited<ReturnType<typeof createClient>>,
  albumIds: string[],
): Promise<Map<string, string>> {
  const latest = new Map<string, string>();
  if (albumIds.length === 0) return latest;

  const { data, error } = await supabase
    .from("media")
    .select("album_id, created_at")
    .in("album_id", albumIds)
    .is("deleted_at", null);

  if (error) throw error;
  for (const row of data ?? []) {
    const existing = latest.get(row.album_id);
    if (!existing || row.created_at > existing) {
      latest.set(row.album_id, row.created_at);
    }
  }
  return latest;
}

const PREVIEW_COUNT = 4;

/** Up to PREVIEW_COUNT recent thumbnail signed URLs per album, most recent first. */
async function getPreviewsByAlbum(
  supabase: Awaited<ReturnType<typeof createClient>>,
  albumIds: string[],
): Promise<Map<string, string[]>> {
  const previews = new Map<string, string[]>();
  if (albumIds.length === 0) return previews;

  const { data, error } = await supabase
    .from("media")
    .select("album_id, thumbnail_storage_path, created_at")
    .in("album_id", albumIds)
    .is("deleted_at", null)
    .not("thumbnail_storage_path", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const pathsByAlbum = new Map<string, string[]>();
  for (const row of data ?? []) {
    const list = pathsByAlbum.get(row.album_id) ?? [];
    if (list.length < PREVIEW_COUNT) {
      list.push(row.thumbnail_storage_path!);
      pathsByAlbum.set(row.album_id, list);
    }
  }

  const signedUrls = await getSignedMediaUrls([...pathsByAlbum.values()].flat());

  for (const [albumId, paths] of pathsByAlbum) {
    previews.set(
      albumId,
      paths.map((p) => signedUrls.get(p)).filter((u): u is string => Boolean(u)),
    );
  }
  return previews;
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
  const albumIds = rows.map((row) => row.id);

  const coverPaths = rows
    .map((row) => row.cover?.storage_path)
    .filter((path): path is string => Boolean(path));
  const [signedUrls, itemCounts, latestUploads, previews] = await Promise.all([
    getSignedMediaUrls(coverPaths),
    countActiveMediaByAlbum(supabase, albumIds),
    getLatestUploadByAlbum(supabase, albumIds),
    getPreviewsByAlbum(supabase, albumIds),
  ]);

  // "Recently active" means real activity (an upload), not just a
  // metadata edit — so albums are ordered by max(updated_at, latest
  // upload) rather than trusting the query's own `ORDER BY updated_at`.
  const withActivity = rows.map((row) => ({
    lastActivity: maxIso(row.updated_at, latestUploads.get(row.id)),
    summary: {
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      cover: row.cover?.storage_path ? (signedUrls.get(row.cover.storage_path) ?? null) : null,
      previewUrls: previews.get(row.id) ?? [],
      itemCount: itemCounts.get(row.id) ?? 0,
      role: (row.membership[0]?.role ?? "viewer") as Role,
      updatedAt: row.updated_at.slice(0, 10),
    } satisfies AlbumSummary,
  }));

  withActivity.sort((a, b) => (a.lastActivity < b.lastActivity ? 1 : -1));

  return withActivity.map((row) => row.summary);
}

function maxIso(a: string, b: string | undefined): string {
  if (!b) return a;
  return a > b ? a : b;
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

  // A malformed id (e.g. a stale bookmark, a typo, a crawler probing paths)
  // isn't a real DB error — Postgres just can't parse it as a uuid (code
  // 22P02, invalid_text_representation). Treat it the same as "not found"
  // instead of throwing an unhandled 500.
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
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
    previewUrls: [], // not used on the album detail page — the full grid is already the "preview"
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
