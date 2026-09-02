-- The "media" bucket (add_media_storage migration) is private — there's
-- no public URL to store. Rename these columns from url/thumbnail_url to
-- storage_path/thumbnail_storage_path so it's clear they hold Storage
-- object paths, not fetchable URLs; signed URLs are generated on demand
-- at read time (see src/lib/storage/media.ts).

alter table public.media rename column url to storage_path;
alter table public.media rename column thumbnail_url to thumbnail_storage_path;
