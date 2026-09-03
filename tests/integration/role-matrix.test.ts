import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  isSupabaseReachable,
  type TestUser,
} from "../helpers/supabase-test-clients";

/**
 * Exercises the PRD §4 role matrix against the *real* RLS policies on the
 * local Supabase Postgres — not a mock. CLAUDE.md's own position is that
 * RLS is the actual enforcement boundary, not just UI hiding (see the
 * Milestone 3 notes on `refine_role_policies`), so this is what "the role
 * matrix is correct" actually means: real signed-in clients, real policy
 * evaluation, no service-role shortcuts except to arrange test state.
 *
 * Requires the local stack from `supabase start` (see CLAUDE.md's "Local
 * backend" section) — skips with a clear reason instead of failing
 * opaquely if it isn't running.
 */

const reachable = await isSupabaseReachable();

describe.skipIf(!reachable)("album role/permission matrix (RLS)", () => {
  let owner: TestUser;
  let member: TestUser; // promoted viewer -> editor -> admin over the course of the suite
  let outsider: TestUser;
  let albumId: string;

  beforeAll(async () => {
    owner = await createTestUser("owner");
    member = await createTestUser("member");
    outsider = await createTestUser("outsider");

    albumId = randomUUID();
    const { error: albumError } = await owner.client
      .from("albums")
      .insert({ id: albumId, owner_id: owner.id, title: "RLS test album" });
    if (albumError) throw albumError;

    const { error: memberError } = await owner.client
      .from("album_members")
      .insert({ album_id: albumId, user_id: member.id, role: "viewer" });
    if (memberError) throw memberError;
  }, 30_000);

  afterAll(async () => {
    await deleteTestUser(owner.id);
    await deleteTestUser(member.id);
    await deleteTestUser(outsider.id);
  });

  it("a non-member cannot see the album at all", async () => {
    const { data, error } = await outsider.client
      .from("albums")
      .select("id")
      .eq("id", albumId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("a non-member cannot add themself to the album", async () => {
    const { error } = await outsider.client
      .from("album_members")
      .insert({ album_id: albumId, user_id: outsider.id, role: "editor" });
    expect(error).not.toBeNull();
  });

  it("a viewer can see the album but cannot edit its title", async () => {
    const read = await member.client.from("albums").select("title").eq("id", albumId).single();
    expect(read.error).toBeNull();
    expect(read.data?.title).toBe("RLS test album");

    const write = await member.client
      .from("albums")
      .update({ title: "Hacked by viewer" })
      .eq("id", albumId)
      .select()
      .maybeSingle();
    expect(write.error).toBeNull();
    expect(write.data).toBeNull(); // silently matched 0 rows — RLS USING excluded the viewer

    const stillOriginal = await owner.client.from("albums").select("title").eq("id", albumId).single();
    expect(stillOriginal.data?.title).toBe("RLS test album");
  });

  it("a viewer cannot upload media", async () => {
    const { error } = await member.client.from("media").insert({
      album_id: albumId,
      uploader_id: member.id,
      kind: "photo",
      storage_path: `${albumId}/${randomUUID()}.jpg`,
      bytes: 1000,
    });
    expect(error).not.toBeNull();
  });

  it("owner promotes the member to editor", async () => {
    const { error } = await owner.client
      .from("album_members")
      .update({ role: "editor" })
      .eq("album_id", albumId)
      .eq("user_id", member.id);
    expect(error).toBeNull();
  });

  it("an editor can edit album details and upload media", async () => {
    const write = await member.client
      .from("albums")
      .update({ title: "Edited by editor" })
      .eq("id", albumId)
      .select()
      .maybeSingle();
    expect(write.error).toBeNull();
    expect(write.data?.title).toBe("Edited by editor");

    const upload = await member.client.from("media").insert({
      album_id: albumId,
      uploader_id: member.id,
      kind: "photo",
      storage_path: `${albumId}/${randomUUID()}.jpg`,
      bytes: 1000,
    });
    expect(upload.error).toBeNull();
  });

  it("an editor cannot soft-delete the album (owner-only)", async () => {
    const { error } = await member.client
      .from("albums")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", albumId);
    // USING matches (editors can "edit"), but WITH CHECK (deleted_at is
    // null) rejects the resulting row — an explicit policy-violation error,
    // not a silent no-op, since the row was matched but the new values fail.
    expect(error).not.toBeNull();

    const stillLive = await owner.client
      .from("albums")
      .select("deleted_at")
      .eq("id", albumId)
      .single();
    expect(stillLive.data?.deleted_at).toBeNull();
  });

  it("owner promotes the member to admin", async () => {
    const { error } = await owner.client
      .from("album_members")
      .update({ role: "admin" })
      .eq("album_id", albumId)
      .eq("user_id", member.id);
    expect(error).toBeNull();
  });

  it("an admin cannot soft-delete the album (owner-only)", async () => {
    const { error } = await member.client
      .from("albums")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", albumId);
    expect(error).not.toBeNull();
  });

  it("an admin can invite a new member and change their role", async () => {
    const invite = await member.client
      .from("album_members")
      .insert({ album_id: albumId, user_id: outsider.id, role: "viewer" });
    expect(invite.error).toBeNull();

    const promote = await member.client
      .from("album_members")
      .update({ role: "editor" })
      .eq("album_id", albumId)
      .eq("user_id", outsider.id)
      .select()
      .maybeSingle();
    expect(promote.error).toBeNull();
    expect(promote.data?.role).toBe("editor");
  });

  it("an admin can never remove the owner, even by trying directly", async () => {
    const { error } = await member.client
      .from("album_members")
      .delete()
      .eq("album_id", albumId)
      .eq("user_id", owner.id);
    expect(error).toBeNull(); // silent no-op: USING excludes role = 'owner' entirely

    const ownerStillMember = await adminClient()
      .from("album_members")
      .select("role")
      .eq("album_id", albumId)
      .eq("user_id", owner.id)
      .single();
    expect(ownerStillMember.data?.role).toBe("owner");
  });

  it("only the owner can soft-delete the album", async () => {
    const { error, data } = await owner.client
      .from("albums")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", albumId)
      .select()
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.deleted_at).not.toBeNull();
  });
});
