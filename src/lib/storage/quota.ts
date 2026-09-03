import { createClient } from "@/lib/supabase/server";

// Decimal GB (10^9 bytes) — matches how storage quotas are conventionally
// advertised (Google, Dropbox, etc.), not binary GiB. docs/PRD.md §6.
export const FREE_TIER_BYTES = 15_000_000_000;

/**
 * Total bytes attributed to one account — every file counts against its
 * *uploader*, not the album owner (docs/PRD.md §6), and soft-deleted media
 * still counts until the Milestone 6 purge job actually removes it, so
 * this deliberately does not filter on deleted_at.
 */
export async function getStorageUsageBytes(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("media").select("bytes").eq("uploader_id", userId);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + row.bytes, 0);
}

/** Pure so the boundary condition (exactly at the cap) is unit-testable without a DB. */
export function wouldExceedQuota(
  currentUsageBytes: number,
  uploadBytes: number,
  limitBytes: number = FREE_TIER_BYTES,
): boolean {
  return currentUsageBytes + uploadBytes > limitBytes;
}

export function formatBytes(bytes: number): string {
  const gb = bytes / 1_000_000_000;
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  const mb = bytes / 1_000_000;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}
