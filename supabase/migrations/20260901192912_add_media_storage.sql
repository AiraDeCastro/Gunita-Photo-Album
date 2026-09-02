-- RLS for the "media" storage bucket (declared in supabase/config.toml).
-- Objects are stored at `{album_id}/{media_id}.{ext}` — the album_id is
-- the first path segment, so the same album_role()/is_album_member()
-- helpers from the albums migrations gate access here too, keeping one
-- definition of "who can see/upload/delete this album's stuff" instead of
-- a second copy of the role matrix.

create policy "album members can read media objects"
  on storage.objects for select
  using (
    bucket_id = 'media'
    and public.is_album_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

create policy "owner/admin/editor can upload media objects"
  on storage.objects for insert
  with check (
    bucket_id = 'media'
    and public.album_role((storage.foldername(name))[1]::uuid, auth.uid())
      in ('owner', 'admin', 'editor')
  );

create policy "owner/admin/editor can delete media objects"
  on storage.objects for delete
  using (
    bucket_id = 'media'
    and public.album_role((storage.foldername(name))[1]::uuid, auth.uid())
      in ('owner', 'admin', 'editor')
  );
