-- Refine RLS from Milestone 1's coarse baseline to the actual PRD §4 role
-- matrix: rename allowed to owner/admin/editor, delete restricted to the
-- owner, member management restricted to owner/admin, viewers read-only
-- everywhere. This is the "Milestone 3" work flagged in the init_schema
-- migration's comments.

-- ---------------------------------------------------------------------
-- albums
-- ---------------------------------------------------------------------

drop policy "members can update albums they belong to" on public.albums;

-- Ordinary edits (rename, description, cover) — not deletion.
create policy "owner/admin/editor can edit album details"
  on public.albums for update
  using (public.album_role(id, auth.uid()) in ('owner', 'admin', 'editor'))
  with check (deleted_at is null);

-- Soft-delete (and, later, restore) — owner only. A second, separate
-- policy rather than folding into the one above: RLS policies are OR'd,
-- so this is the only path that's allowed to touch deleted_at at all.
create policy "owner can delete or restore the album"
  on public.albums for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- album_members
-- ---------------------------------------------------------------------

drop policy "owner manages membership" on public.album_members;
drop policy "owner updates membership" on public.album_members;
drop policy "owner removes membership, or a member removes themself" on public.album_members;

create policy "owner/admin invite members"
  on public.album_members for insert
  with check (
    public.album_role(album_id, auth.uid()) in ('owner', 'admin')
    and role <> 'owner'
  );

create policy "owner/admin change a non-owner member's role"
  on public.album_members for update
  using (
    role <> 'owner'
    and public.album_role(album_id, auth.uid()) in ('owner', 'admin')
  )
  with check (role <> 'owner');

-- Owner/admin remove a non-owner member; anyone can remove themself
-- (leave) — but never the owner's own row, by either path.
create policy "owner/admin remove a non-owner member, or a member leaves"
  on public.album_members for delete
  using (
    role <> 'owner'
    and (
      public.album_role(album_id, auth.uid()) in ('owner', 'admin')
      or user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- media — viewers get read-only; owner/admin/editor can manage media
-- ---------------------------------------------------------------------

drop policy "members can upload media" on public.media;
drop policy "members can edit media in their albums" on public.media;
drop policy "members can delete media in their albums" on public.media;

create policy "owner/admin/editor can upload media"
  on public.media for insert
  with check (
    public.album_role(album_id, auth.uid()) in ('owner', 'admin', 'editor')
    and uploader_id = auth.uid()
  );

create policy "owner/admin/editor can edit media"
  on public.media for update
  using (public.album_role(album_id, auth.uid()) in ('owner', 'admin', 'editor'));

create policy "owner/admin/editor can delete media"
  on public.media for delete
  using (public.album_role(album_id, auth.uid()) in ('owner', 'admin', 'editor'));
