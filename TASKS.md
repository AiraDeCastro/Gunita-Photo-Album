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

## Milestone 3 — Albums, sharing & roles

- [ ] Create album (title, description, private or shared)
- [ ] List a user's albums (owned + member-of) to feed the browse rows
- [ ] Autosave title/description edits
- [ ] Set/replace album cover
- [ ] Delete album → soft delete (owner-only)
- [ ] Invite a member by account email, assign a role
- [ ] Change a member's role (owner/admin only)
- [ ] Remove a member (owner/admin only, admin can't remove owner)
- [ ] Let a non-owner member leave an album
- [ ] Enforce the full role capability matrix (PRD §4) server-side on every album/media mutation — not just hidden in the UI

## Milestone 4 — Upload & media pipeline

- [ ] Wire multi-file drag-and-drop + file picker to real uploads
- [ ] Client-side validation: accepted formats, 25 MB photo limit
- [ ] Server-side validation mirroring the client (never trust client-side checks alone)
- [ ] Integrate the chosen media pipeline (Cloudinary, per `PLANNING.md`) for storage + CDN delivery
- [ ] Enforce video caps: 1080p, 5 minutes, 1 GB per file (transcode or reject over-limit uploads)
- [ ] Generate thumbnails (photo; first-frame for video)
- [ ] Per-file upload progress, with failed files flagged individually
- [ ] Delete a single photo/video with confirmation → soft delete

## Milestone 5 — Storage accounting

- [ ] Record byte size per media row, attributed to the uploader's account
- [ ] Compute an account's total usage (sum query or maintained counter)
- [ ] Block uploads past 15 GB with a clear message and no effect on existing media
- [ ] Replace the static usage bar on the Account page with live data

## Milestone 6 — Deletion & recovery

- [ ] Soft-delete model: `deleted_at` / `purge_at` (= +30 days) on albums and media
- [ ] Recently Deleted page: real list, days-remaining, restore action
- [ ] Restore a single photo/video back to its album
- [ ] Restore an album with its remaining media and membership intact
- [ ] Scheduled job (Vercel Cron, per `PLANNING.md`) to hard-purge items past `purge_at` and free the underlying storage objects
- [ ] Confirm storage accounting still counts soft-deleted items until purge

## Milestone 7 — Browse experience, connected to real data

- [ ] Replace `src/lib/mock-data.ts` calls with real queries for rows and hero
- [ ] Hero picks the user's most-recently-active album dynamically
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
