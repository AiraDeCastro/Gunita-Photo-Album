import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { wouldExceedQuota } from "@/lib/storage/quota";
import { createTestUser, deleteTestUser, isSupabaseReachable, type TestUser } from "../helpers/supabase-test-clients";

/**
 * `getStorageUsageBytes` (src/lib/storage/quota.ts) can't be called
 * directly here — it goes through `@/lib/supabase/server`, which needs a
 * live Next.js request for its cookie-bound client. Instead this exercises
 * the same query it runs (sum of `media.bytes` for one uploader, no
 * `deleted_at` filter — soft-deleted media still counts against quota
 * until the purge job removes it, per CLAUDE.md) against the real local
 * DB under RLS, then feeds the real result into `wouldExceedQuota` — the
 * same pure decision function the upload route calls. Together that's the
 * actual enforcement path, database read included, minus only the HTTP
 * layer itself.
 */

const reachable = await isSupabaseReachable();

describe.skipIf(!reachable)("storage-cap enforcement path", () => {
  let uploader: TestUser;
  let albumId: string;

  beforeAll(async () => {
    uploader = await createTestUser("quota");

    albumId = randomUUID();
    const { error: albumError } = await uploader.client
      .from("albums")
      .insert({ id: albumId, owner_id: uploader.id, title: "Quota test album" });
    if (albumError) throw albumError;

    const rows = [
      { bytes: 4_000_000_000, deleted_at: null }, // 4 GB, live
      { bytes: 3_000_000_000, deleted_at: null }, // 3 GB, live
      { bytes: 2_000_000_000, deleted_at: new Date().toISOString() }, // 2 GB, soft-deleted
    ];
    for (const row of rows) {
      const { error } = await uploader.client.from("media").insert({
        album_id: albumId,
        uploader_id: uploader.id,
        kind: "photo",
        storage_path: `${albumId}/${randomUUID()}.jpg`,
        bytes: row.bytes,
        deleted_at: row.deleted_at,
      });
      if (error) throw error;
    }
  }, 30_000);

  afterAll(async () => {
    await deleteTestUser(uploader.id);
  });

  it("counts soft-deleted media toward usage, matching getStorageUsageBytes's own query", async () => {
    const { data, error } = await uploader.client
      .from("media")
      .select("bytes")
      .eq("uploader_id", uploader.id);
    expect(error).toBeNull();

    const totalBytes = (data ?? []).reduce((sum, row) => sum + row.bytes, 0);
    expect(totalBytes).toBe(9_000_000_000); // 4 + 3 + 2 GB, deleted one included
  });

  it("blocks an upload that would push a near-cap account over 15 GB", async () => {
    const { data } = await uploader.client.from("media").select("bytes").eq("uploader_id", uploader.id);
    const currentUsage = (data ?? []).reduce((sum, row) => sum + row.bytes, 0);

    expect(wouldExceedQuota(currentUsage, 6_000_000_001)).toBe(true); // 9 + 6GB+1B > 15GB
    expect(wouldExceedQuota(currentUsage, 6_000_000_000)).toBe(false); // exactly 15 GB, allowed
  });
});
