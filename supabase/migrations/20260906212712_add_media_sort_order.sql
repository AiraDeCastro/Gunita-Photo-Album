-- Manual media ordering within an album (drag-to-reorder, TASKS.md
-- Milestone 10). Ascending sort_order is the display order (lower =
-- shown first). Backfilled to match the existing created_at-descending
-- (newest-first) display order exactly, so applying this migration
-- doesn't visibly reshuffle any album that already has media in it.
alter table public.media add column sort_order integer not null default 0;

with ranked as (
  select id, row_number() over (partition by album_id order by created_at desc) - 1 as rn
  from public.media
)
update public.media
set sort_order = ranked.rn
from ranked
where media.id = ranked.id;

-- New uploads get a sort_order one less than the current minimum for
-- that album (src/app/api/media/upload/route.ts computes this), so a
-- fresh upload keeps appearing first without renumbering every other
-- row in the album on every upload. A manual reorder
-- (src/lib/media/actions.ts's reorderMedia) renumbers the whole album to
-- 0..n-1 in one pass, which resets that gap cleanly.
create index media_album_id_sort_order_idx on public.media (album_id, sort_order);
