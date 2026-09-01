import { createClient } from "@/lib/supabase/server";
import type { AlbumDetail, AlbumSummary, Role } from "./types";

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
      cover:media!albums_cover_media_id_fkey ( url ),
      membership:album_members!inner ( role, user_id ),
      media!media_album_id_fkey ( count )
    `,
    )
    .eq("album_members.user_id", user.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    cover: row.cover?.url ?? null,
    itemCount: row.media?.[0]?.count ?? 0,
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
      cover:media!albums_cover_media_id_fkey ( url ),
      media!media_album_id_fkey ( count ),
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

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    type: data.type,
    cover: data.cover?.url ?? null,
    itemCount: data.media?.[0]?.count ?? 0,
    role: mine.role,
    updatedAt: data.updated_at.slice(0, 10),
    members,
  };
}
