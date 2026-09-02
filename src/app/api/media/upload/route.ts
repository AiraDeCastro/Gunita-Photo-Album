import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET } from "@/lib/storage/media";
import { FREE_TIER_BYTES, formatBytes, getStorageUsageBytes } from "@/lib/storage/quota";
import {
  extensionForMime,
  kindForMime,
  validateFile,
  validateVideoMetadata,
} from "@/lib/media/constraints";

/**
 * Handles the actual file bytes — a Route Handler rather than a Server
 * Action so there's no need to raise Server Actions' default ~1MB body
 * limit to fit a 1GB video. Client-side validation in MediaUploader is
 * UX only; everything here is re-checked, never trusted.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const form = await request.formData();
  const albumId = String(form.get("albumId") ?? "");
  const file = form.get("file");
  const thumbnail = form.get("thumbnail");
  const width = form.get("width") ? Number(form.get("width")) : null;
  const height = form.get("height") ? Number(form.get("height")) : null;
  const durationSeconds = form.get("durationSeconds") ? Number(form.get("durationSeconds")) : null;

  if (!albumId || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing album or file." }, { status: 400 });
  }

  const fileError = validateFile(file);
  if (fileError) return NextResponse.json(fileError, { status: 400 });

  const currentUsage = await getStorageUsageBytes(user.id);
  if (currentUsage + file.size > FREE_TIER_BYTES) {
    return NextResponse.json(
      {
        error: `This upload would put you over your ${formatBytes(FREE_TIER_BYTES)} free storage limit (${formatBytes(currentUsage)} used). Delete some media or upgrade your plan.`,
      },
      { status: 400 },
    );
  }

  const kind = kindForMime(file.type)!;
  if (kind === "video" && durationSeconds !== null && width !== null && height !== null) {
    const videoError = validateVideoMetadata(durationSeconds, width, height);
    if (videoError) return NextResponse.json(videoError, { status: 400 });
  }

  const mediaId = crypto.randomUUID();
  const path = `${albumId}/${mediaId}.${extensionForMime(file.type)}`;

  // RLS on storage.objects (add_media_storage migration) is what actually
  // enforces "only owner/admin/editor of this album" — this call fails on
  // its own for anyone else, independent of any app-level role check.
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  let thumbnailPath: string | null = null;
  if (thumbnail instanceof File) {
    thumbnailPath = `${albumId}/${mediaId}-thumb.jpg`;
    const { error: thumbError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(thumbnailPath, thumbnail, { contentType: "image/jpeg", upsert: false });
    if (thumbError) {
      await supabase.storage.from(MEDIA_BUCKET).remove([path]);
      return NextResponse.json({ error: thumbError.message }, { status: 400 });
    }
  }

  const { error: insertError } = await supabase.from("media").insert({
    id: mediaId,
    album_id: albumId,
    uploader_id: user.id,
    kind,
    storage_path: path,
    thumbnail_storage_path: thumbnailPath,
    bytes: file.size,
    width,
    height,
    duration_seconds: durationSeconds,
  });

  if (insertError) {
    await supabase.storage
      .from(MEDIA_BUCKET)
      .remove(thumbnailPath ? [path, thumbnailPath] : [path]);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  // First upload becomes the album cover, per docs/PRD.md §3.
  const { data: album } = await supabase
    .from("albums")
    .select("cover_media_id")
    .eq("id", albumId)
    .maybeSingle();
  if (album && !album.cover_media_id) {
    await supabase.from("albums").update({ cover_media_id: mediaId }).eq("id", albumId);
  }

  revalidatePath(`/album/${albumId}`);
  revalidatePath("/");

  return NextResponse.json({ id: mediaId });
}
