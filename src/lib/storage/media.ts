import { createClient } from "@/lib/supabase/server";

export const MEDIA_BUCKET = "media";

// Plenty for a single page render — pages are already dynamic (cookie-based
// auth), so there's no benefit to a longer-lived signed URL here.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Signed URL for one Storage object path, or null if there isn't one. */
export async function getSignedMediaUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

/** Batch version — path -> signed URL, skipping any that failed to sign. */
export async function getSignedMediaUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return map;

  for (const item of data) {
    if (!item.error && item.signedUrl && item.path) {
      map.set(item.path, item.signedUrl);
    }
  }
  return map;
}
