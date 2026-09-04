"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "./types";

export type ActionState = { error: string | null };

const noError: ActionState = { error: null };

export async function createAlbum(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the album a title." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  // Generate the id client-side and skip `.select()` (no RETURNING):
  // handle_new_album (an AFTER INSERT trigger) inserts the owner's own
  // album_members row as part of this same statement, and RETURNING has
  // to satisfy the SELECT policy — which depends on that trigger's
  // effect — before the trigger's insert is reliably visible to it.
  // Reproduced directly against Postgres; see the fix_rls_helper_volatility
  // migration for the rest of this story. Knowing the id upfront sidesteps
  // it entirely rather than racing the trigger.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("albums").insert({ id, owner_id: user.id, title });

  if (error) return { error: error.message };

  revalidatePath("/");
  redirect(`/album/${id}`);
}

export async function updateAlbumDetails(
  albumId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title) return { error: "Title can't be empty." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("albums")
    .update({
      title,
      description: description || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", albumId);

  if (error) return { error: error.message };

  revalidatePath(`/album/${albumId}`);
  revalidatePath("/");
  return noError;
}

/**
 * Only photos can be a cover — the album card/hero render it as an
 * `<Image>`, and a video's `storage_path` points at the video file itself,
 * not something Image can display. Verifying the media row actually
 * belongs to this album (not just that *a* media row with this id exists
 * somewhere) also guards against a same-album editor pointing the cover at
 * media from an album they don't otherwise have access to; RLS wouldn't
 * leak that media's contents either way (the embedded select in
 * `getAlbumDetail` just comes back empty), but there's no reason to allow
 * a nonsense cover reference in the first place.
 */
export async function setAlbumCover(albumId: string, mediaId: string) {
  const supabase = await createClient();

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select("kind")
    .eq("id", mediaId)
    .eq("album_id", albumId)
    .is("deleted_at", null)
    .maybeSingle();
  if (mediaError) throw new Error(mediaError.message);
  if (!media) throw new Error("That item isn't in this album.");
  if (media.kind !== "photo") throw new Error("Only photos can be set as the cover.");

  const { error } = await supabase
    .from("albums")
    .update({ cover_media_id: mediaId })
    .eq("id", albumId);
  if (error) throw new Error(error.message);

  revalidatePath(`/album/${albumId}`);
  revalidatePath("/");
}

export async function setAlbumType(albumId: string, type: "private" | "shared") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("albums")
    .update({ type, updated_at: new Date().toISOString() })
    .eq("id", albumId);
  if (error) throw new Error(error.message);

  revalidatePath(`/album/${albumId}`);
  revalidatePath("/");
}

export async function deleteAlbum(albumId: string) {
  const supabase = await createClient();
  const purgeAt = new Date();
  purgeAt.setDate(purgeAt.getDate() + 30);

  const { error } = await supabase
    .from("albums")
    .update({ deleted_at: new Date().toISOString(), purge_at: purgeAt.toISOString() })
    .eq("id", albumId);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  redirect("/");
}

export async function inviteMember(
  albumId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "viewer") as Role;
  if (!email) return { error: "Enter an email address." };
  if (role === "owner") return { error: "Invited members can't be made Owner." };

  const supabase = await createClient();

  // Looking up an invitee has to bypass RLS: "profiles are viewable by
  // album co-members" is exactly false for someone not yet invited — a
  // chicken-and-egg problem an invite flow always runs into. The admin
  // client here only ever returns an id for an exact email match, and
  // the actual membership insert below stays on the RLS-respecting
  // client, so who's *allowed* to invite is still enforced at the DB
  // layer, not just by this lookup succeeding.
  const admin = createAdminClient();
  const { data: profile, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) return { error: lookupError.message };
  if (!profile) {
    return {
      error: "No Gunita account found for that email. They'll need to sign up first.",
    };
  }

  // Setting type to "shared" here means inviting someone is what converts
  // a private album to shared, matching docs/PRD.md §3.
  const [{ error: memberError }, { error: typeError }] = await Promise.all([
    supabase.from("album_members").insert({ album_id: albumId, user_id: profile.id, role }),
    supabase.from("albums").update({ type: "shared" }).eq("id", albumId),
  ]);

  if (memberError) {
    if (memberError.code === "23505") {
      return { error: "That person is already a member of this album." };
    }
    return { error: memberError.message };
  }
  if (typeError) return { error: typeError.message };

  revalidatePath(`/album/${albumId}`);
  return noError;
}

export async function changeMemberRole(albumId: string, userId: string, role: Role) {
  if (role === "owner") throw new Error("Can't change a member's role to Owner.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("album_members")
    .update({ role })
    .eq("album_id", albumId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  revalidatePath(`/album/${albumId}`);
}

export async function removeMember(albumId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("album_members")
    .delete()
    .eq("album_id", albumId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  revalidatePath(`/album/${albumId}`);
}

export async function leaveAlbum(albumId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in.");

  const { error } = await supabase
    .from("album_members")
    .delete()
    .eq("album_id", albumId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  redirect("/");
}

/** Owner-only, per the "owner can delete or restore the album" RLS policy. */
export async function restoreAlbum(albumId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("albums")
    .update({ deleted_at: null, purge_at: null })
    .eq("id", albumId);

  if (error) throw new Error(error.message);

  revalidatePath("/recently-deleted");
  revalidatePath("/");
}
