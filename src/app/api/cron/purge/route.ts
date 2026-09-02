import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/lib/storage/media";

/**
 * Hard-purges anything past its purge_at (docs/PRD.md §7 — 30 days after
 * soft-delete). Meant to run on a schedule (see vercel.json) via Vercel
 * Cron, which sends `Authorization: Bearer $CRON_SECRET`. Locally, with
 * CRON_SECRET unset in .env.local, the check is skipped so this can be
 * called directly for testing.
 *
 * Uses the admin client on purpose — this has to purge across every
 * account, not just the caller's own rows, which is exactly what RLS is
 * supposed to prevent for a normal request.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: expiredMedia, error: mediaFetchError } = await supabase
    .from("media")
    .select("id, storage_path, thumbnail_storage_path")
    .not("purge_at", "is", null)
    .lte("purge_at", now);
  if (mediaFetchError) {
    return NextResponse.json({ error: mediaFetchError.message }, { status: 500 });
  }

  for (const item of expiredMedia ?? []) {
    const paths = [item.storage_path, item.thumbnail_storage_path].filter(
      (p): p is string => Boolean(p),
    );
    if (paths.length > 0) {
      await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    }
    await supabase.from("media").delete().eq("id", item.id);
  }

  const { data: expiredAlbums, error: albumFetchError } = await supabase
    .from("albums")
    .select("id")
    .not("purge_at", "is", null)
    .lte("purge_at", now);
  if (albumFetchError) {
    return NextResponse.json({ error: albumFetchError.message }, { status: 500 });
  }

  for (const album of expiredAlbums ?? []) {
    // Clean up storage for every remaining media row in this album (not
    // just already-soft-deleted ones) before the album row goes — the
    // FK cascade on album_members/media handles the DB rows, but nothing
    // cleans up the actual Storage objects on its own.
    const { data: albumMedia, error: albumMediaError } = await supabase
      .from("media")
      .select("storage_path, thumbnail_storage_path")
      .eq("album_id", album.id);
    if (albumMediaError) {
      return NextResponse.json({ error: albumMediaError.message }, { status: 500 });
    }

    const paths = (albumMedia ?? [])
      .flatMap((m) => [m.storage_path, m.thumbnail_storage_path])
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    }

    await supabase.from("albums").delete().eq("id", album.id);
  }

  return NextResponse.json({
    purgedMedia: expiredMedia?.length ?? 0,
    purgedAlbums: expiredAlbums?.length ?? 0,
  });
}
