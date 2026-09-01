-- `is_album_member` / `album_role` were declared STABLE, which lets
-- Postgres cache/reuse their result within a single statement. That
-- collides with `handle_new_album` (an AFTER INSERT trigger that inserts
-- the owner's own album_members row as part of the same INSERT statement
-- that creates the album): `INSERT INTO albums ... RETURNING id` has to
-- satisfy the SELECT policy (is_album_member) to return the row, and a
-- stale STABLE result — cached from before the trigger's insert became
-- visible — makes that check fail even though the membership row exists
-- by the time RETURNING actually runs. Reproduced directly against
-- Postgres: the same INSERT succeeds without RETURNING, fails with it.
--
-- Fix: mark both helpers VOLATILE so they're always evaluated fresh.
-- They're cheap single-row lookups called per policy check, not in a
-- hot loop, so this has no meaningful performance cost here.

alter function public.is_album_member(uuid, uuid) volatile;
alter function public.album_role(uuid, uuid) volatile;
