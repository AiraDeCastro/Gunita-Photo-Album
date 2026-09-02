# TASKS.md

Build tasks for Gunita, grouped into milestones. Derived from
[`docs/PRD.md`](docs/PRD.md) (scope/behavior) and [`PLANNING.md`](PLANNING.md)
(architecture/stack). Check items off as they land; this is a living
document, not a one-time plan — update it when scope changes.

## Milestone 0 — Foundations *(done)*

- [x] Next.js (App Router) + TypeScript + Tailwind v4 scaffold
- [x] Design tokens + light/dark theme matching the PRD's visual identity
- [x] Fraunces / Work Sans / IBM Plex Mono type system wired via `next/font`
- [x] Browse home UI (hero + horizontal rows) against mock data
- [x] Album detail page UI against mock data
- [x] Sign-in / sign-up UI (no auth logic yet)
- [x] Account page UI (storage bar, static)
- [x] Recently Deleted page UI (static)
- [x] `docs/PRD.md`, `CLAUDE.md`, `PLANNING.md` written

## Milestone 1 — Backend foundation

- [x] Provision the chosen Auth + Postgres provider — running locally via the Supabase CLI + Docker (`supabase start`); a cloud project is only needed at deploy time
- [x] Define schema: `profiles` (the PLANNING.md `users` table, Supabase-named since `auth.users` already holds credentials), `albums`, `album_members`, `media` — `supabase/migrations/20260901153029_init_schema.sql`
- [x] Wire a DB client/ORM into the Next.js server layer — `src/lib/supabase/{client,server,admin,middleware}.ts` (browser client, server client, RLS-bypassing admin client, session-refresh proxy), typed against generated `src/lib/supabase/types.ts`
- [x] Set up `.env.local` conventions and document required variables — `.env.local` (gitignored) has the local Supabase URL/keys; `.env.example` documents the shape and is committed
- [x] Confirm row-level security (or equivalent) is enabled before any real data lands in the DB — RLS is on for all 4 tables with baseline ownership/membership policies (verified: 4/4/4/3 policies respectively). This is coarse-grained on purpose; the full per-role capability matrix is still Milestone 3's job, not redone here.

## Milestone 2 — Authentication (v1: sign up / sign in / sign out) *(done)*

- [x] Wire the sign-up form to real account creation — `supabase.auth.signUp` via a server action, `src/lib/auth/actions.ts`
- [x] Wire sign-in with session persistence — `signInWithPassword`, cookie session refreshed on every request by `src/lib/supabase/middleware.ts` (wired through `src/proxy.ts`)
- [x] Wire sign-out from the account menu — form + server action on the Account page
- [x] Protect album/media/account routes server-side for unauthenticated requests — `updateSession()` redirects signed-out users to `/sign-in` and signed-in users away from it; verified against `/`, `/account`, `/album/[id]`
- [x] Basic email + password validation matching PRD §Authentication — email-format regex + 8-char minimum, enforced both client-side (`minLength`) and server-side (`validate()` in the action, and Supabase's own `minimum_password_length = 8` in `supabase/config.toml`)

Verified in the browser: sign-up → session → browse home (Navbar shows real
initials instead of the old static "YOU"); sign-out → `/sign-in`; sign-in
with correct/incorrect credentials (error renders in the new `--danger`
token); every protected route redirects when signed out.

## Milestone 3 — Albums, sharing & roles *(done except cover images)*

- [x] Create album (title, description, private or shared) — `createAlbum`; starts private, `inviteMember` flips it to shared (PRD §3)
- [x] List a user's albums (owned + member-of) to feed the browse rows — `getAlbumsForCurrentUser`, wired into `src/app/page.tsx`
- [x] Autosave title/description edits — `AlbumSettingsForm`, saves on blur
- [ ] Set/replace album cover — blocked on Milestone 4: there's no media yet to set as a cover, nothing to build here until upload exists
- [x] Delete album → soft delete (owner-only) — `deleteAlbum`; verified `deleted_at`/`purge_at` (+30d) set correctly, row not actually removed
- [x] Invite a member by account email, assign a role — `inviteMember`; see note below on a real RLS bug this surfaced
- [x] Change a member's role (owner/admin only) — `changeMemberRole`
- [x] Remove a member (owner/admin only, admin can't remove owner) — `removeMember`
- [x] Let a non-owner member leave an album — `leaveAlbum`
- [x] Enforce the full role capability matrix (PRD §4) server-side on every album/media mutation — `refine_role_policies` migration (owner/admin/editor can edit, owner-only delete, owner/admin manage members, viewers read-only); not just UI hiding — RLS is the actual boundary

Verified end-to-end in the browser with two real accounts (alice/bob):
create → rename (persists after reload) → invite (private→shared badge
flips) → role change (persists after reload) → owner-side "Remove" →
member-side "Leave" → delete (confirmed soft, not hard, via psql). Viewer
role correctly loses the edit form, Upload button, Delete button, and
invite/role UI; owner keeps all of it. (Editor/admin weren't separately
role-played through the browser — they share the same `canEdit`/`canManage`
boolean checks already exercised by the owner/viewer extremes, not a
distinct code path.)

Two real bugs turned up and got fixed along the way, both worth knowing
about if you touch this area again:
- **RLS + AFTER trigger + `RETURNING` race**: `is_album_member`/`album_role`
  were `STABLE`, which let Postgres reuse a cached result from before
  `handle_new_album` (an AFTER INSERT trigger) had inserted the owner's own
  membership row — so `INSERT INTO albums ... RETURNING id` failed its own
  SELECT-policy check even though the row was valid. Fixed by marking both
  helpers `VOLATILE` (`fix_rls_helper_volatility` migration) *and* having
  `createAlbum` generate the id client-side to avoid `RETURNING` there
  entirely. If a future insert-with-a-dependent-trigger needs `RETURNING`,
  expect to hit this again.
- **Inviting requires bypassing RLS for the lookup**: "profiles are viewable
  by album co-members" is exactly false for someone not yet invited — a
  chicken-and-egg problem. `inviteMember` now looks up the invitee's profile
  via the admin (service-role) client, while the actual `album_members`
  insert stays on the RLS-respecting client — so *who's allowed to invite*
  is still enforced at the DB layer, only the lookup itself bypasses it.

## Milestone 4 — Upload & media pipeline *(done)*

- [x] Wire multi-file drag-and-drop + file picker to real uploads — `MediaUploader` (hidden input + drop zone), one XHR per file
- [x] Client-side validation: accepted formats, 25 MB photo limit — `src/lib/media/constraints.ts`, shared with the server so the two can't drift
- [x] Server-side validation mirroring the client (never trust client-side checks alone) — `src/app/api/media/upload/route.ts`; verified by bypassing the client entirely (curl, fabricated `fetch` payloads) — wrong mime, oversized photo, and over-duration video all correctly rejected with 400s
- [x] Integrate a media pipeline for storage + CDN delivery — **Supabase Storage**, not Cloudinary (see `PLANNING.md`): a private `media` bucket, RLS on `storage.objects` reusing the same `album_role`/`is_album_member` helpers, signed URLs generated at read time (`src/lib/storage/media.ts`)
- [x] Enforce video caps: 1080p, 5 minutes, 1 GB per file — by **rejecting** over-limit uploads (no transcoding, consistent with the Supabase Storage decision); duration/resolution read client-side from real decoded video metadata and re-checked server-side
- [x] Generate thumbnails (photo; first-frame for video) — client-side canvas, no ffmpeg/sharp dependency; verified end-to-end for both photo and a real recorded video (canvas → MediaRecorder → decoded → frame-captured → uploaded)
- [x] Per-file upload progress, with failed files flagged individually — `XMLHttpRequest.upload.onprogress` per file; failed files show inline with a dismiss action, independent of other files in the same batch
- [x] Delete a single photo/video with confirmation → soft delete — inline confirm (no `window.confirm()`), clears the album's cover if the deleted item was it

Two real bugs found and fixed while testing this against the live stack
(both worth knowing about before touching this code again — see
`CLAUDE.md`): Next's Image Optimizer refuses private-IP hosts by default
(blocks local Supabase Storage URLs) and, more importantly, Next's
middleware has a ~10MB body-read cap that was silently corrupting any
upload over that size — fixed by excluding `/api/*` from the proxy
matcher, which is also just the correct design (an API route should
answer 401 JSON, not redirect to `/sign-in`).

## Milestone 5 — Storage accounting *(done)*

- [x] Record byte size per media row, attributed to the uploader's account — already landed in Milestone 4 (`media.bytes` + `media.uploader_id`, set at upload time)
- [x] Compute an account's total usage — `getStorageUsageBytes` in `src/lib/storage/quota.ts`, a plain sum over the uploader's `media` rows (deliberately includes soft-deleted ones — they still count until Milestone 6 actually purges them)
- [x] Block uploads past 15 GB with a clear message and no effect on existing media — checked in the upload route right after format/size validation, before anything touches Storage or the DB
- [x] Replace the static usage bar on the Account page with live data — `src/app/account/page.tsx`

Verified live: temporarily lowered `FREE_TIER_BYTES` to below the test
account's actual usage, confirmed the upload route rejected a new file
with the limit message and left the `media` table's row count/byte total
unchanged, then confirmed a normal upload still succeeds once the real
15 GB constant was restored.

## Milestone 6 — Deletion & recovery *(done)*

- [x] Soft-delete model: `deleted_at` / `purge_at` (= +30 days) on albums and media — already existed since Milestones 3–4
- [x] Recently Deleted page: real list, days-remaining, restore action — `src/app/recently-deleted/page.tsx`, merging `getDeletedAlbums`/`getDeletedMedia`; `mock-data.ts` is gone, nothing references it anymore
- [x] Restore a single photo/video back to its album — `restoreMedia`, same owner/admin/editor role check as delete (no new RLS needed — the existing "edit media" policy has no `WITH CHECK` restricting `deleted_at`)
- [x] Restore an album with its remaining media and membership intact — `restoreAlbum`, owner-only; membership/media were never touched by the soft-delete in the first place, so restoring is just clearing two columns
- [x] Scheduled job to hard-purge items past `purge_at` and free the underlying storage objects — `src/app/api/cron/purge/route.ts` (admin client, bypasses RLS on purpose — this has to act across every account), wired to Vercel Cron via `vercel.json` (daily); `CRON_SECRET` gates it when set, unset locally so it can be called directly for testing
- [x] Confirm storage accounting still counts soft-deleted items until purge — unchanged from Milestone 5, still true (`getStorageUsageBytes` has no `deleted_at` filter)

Verified live end-to-end, not just build/lint: deleted then restored a
photo (reappeared with its real thumbnail intact) and an album (reappeared
with all 6 items and owner membership intact); backdated a media row's and
then an album's `purge_at` into the past via psql and called the purge
endpoint directly — confirmed the media purge removed exactly the DB row
and its storage object, and the album purge cascaded through
`album_members` and `media` (FK) while the route explicitly cleaned up all
8 of that album's storage objects first. Also confirmed the `CRON_SECRET`
auth gate: 401 with no header or the wrong value, 200 with the right one.

## Milestone 7 — Browse experience, connected to real data

- [x] Replace `src/lib/mock-data.ts` calls with real queries for rows and hero — done early, as part of Milestone 3 (`getAlbumsForCurrentUser`); `mock-data.ts` itself is gone as of Milestone 6, once Recently Deleted (its last caller) moved to real data too
- [ ] Hero picks the user's most-recently-active album dynamically — currently just "most recently updated" (`ORDER BY updated_at DESC`), a placeholder until there's upload activity to be "active" about
- [ ] Hover-preview interaction on album cards (image cycle or muted video preview)
- [ ] Lightbox view for a single media item with next/previous navigation
- [ ] Responsive pass: swipeable rows and shortened hero on mobile

## Milestone 8 — Non-functional hardening

- [ ] Audit every route/server action for server-side authorization (PRD §NFR)
- [ ] Lazy-load thumbnails and hover previews
- [ ] Full keyboard navigation across rows and the lightbox, with visible focus states
- [ ] Alt text on all images; respect `prefers-reduced-motion`
- [ ] Resumable or clearly retryable upload on interruption
- [ ] Automated tests covering the role/permission matrix and the storage-cap enforcement path

## Milestone 9 — v1 launch

- [ ] Deploy to Vercel (staging + production environments)
- [ ] Golden-path smoke test: sign up → create shared album → invite a member → upload → edit → delete → restore
- [ ] Update `README.md` with real setup steps (provider accounts, env vars)
- [ ] Push to `origin/main` on GitHub (pending explicit go-ahead — see `CLAUDE.md`)

## Milestone 10 — v1.1

- [ ] Stripe billing integration and paid storage tiers
- [ ] Higher video resolution/length ceilings for paid accounts
- [ ] Password reset flow
- [ ] Drag-to-reorder media within an album
- [ ] Search across albums
- [ ] Year-based rows on the browse home

## Milestone 11 — v2

- [ ] Public, view-only link sharing
- [ ] Tagging / people-grouping
- [ ] Real-time collaborative editing

## Before starting any item above

`docs/PRD.md` §10 has no open questions outstanding for v1 — the invite
mechanism, removed-member media handling, downgrade grace period, and
emergency Owner removal are all resolved (see `CLAUDE.md`'s locked-in
decisions). If a new ambiguity turns up while implementing, flag it rather
than silently picking an answer.
