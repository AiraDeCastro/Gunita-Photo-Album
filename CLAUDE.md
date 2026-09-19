# CLAUDE.md

Guidance for Claude Code sessions working in this repository.

## What this project is

Gunita (Tagalog: "memory") is a photo & video album web app. Its
distinguishing feature is the home screen: instead of a flat camera-roll
grid, albums are browsed like titles on Netflix — a hero banner, horizontally
scrolling rows, cards that lift and preview on hover — applied to a warm,
archival visual identity (not a streaming-service look).

**Full product requirements: [`docs/PRD.md`](docs/PRD.md).** Read it before
making product-behavior decisions (roles, storage limits, deletion rules,
media specs) — this file only summarizes what's load-bearing for day-to-day
coding, and PRD.md is the source of truth if the two ever disagree.

## Current status

Auth (Milestone 2), albums/sharing/roles (Milestone 3), upload/media
(Milestone 4), storage accounting (Milestone 5), deletion/recovery
(Milestone 6), the browse experience (Milestone 7), and non-functional
hardening (Milestone 8) are all real now — that's every Milestone 0–8 item
done. Sign-up/sign-in/sign-out go through
Supabase Auth; every route redirects signed-out users to `/sign-in`. Albums
are created, renamed, deleted, shared, and role-managed against the real
`albums`/`album_members` tables (`src/lib/albums/`) — RLS is the actual
enforcement boundary, not just UI hiding. Photos and videos upload for real
to Supabase Storage (`src/lib/media/`, `src/lib/storage/`), with
client-side thumbnails, per-file progress, soft-delete, and a real 15
GB/account cap enforced at upload time (`src/lib/storage/quota.ts`) — the
Account page's usage bar is live. Deleted albums/media show up for real in
`/recently-deleted`, are restorable within 30 days, and a purge job
hard-deletes anything past that — see "Deletion & recovery" below. The
browse home's hero and hover-preview cards are driven by real activity and
real thumbnails, and every media grid opens into a real lightbox — see
"Browse experience" below. `src/lib/mock-data.ts` is gone; nothing in
`src/` reads from it anymore. The app has a real test suite now (Vitest —
see "Testing" below), the RLS role matrix is verified against a live local
Postgres rather than just reviewed, uploads are retryable on failure, and
the hover-preview/lightbox got an accessibility pass (lazy-loaded previews,
real alt text, `prefers-reduced-motion`, a focus-trapped lightbox).

Milestone 9 (v1 launch) is done: the app is deployed to production on
Vercel (`gunita-photo-album.vercel.app`), connected to a real cloud
Supabase project, and the golden-path flow (sign up → create shared album
→ invite → upload → edit → delete → restore) has been verified live
against production itself, not just locally. See "Deploying to production"
below for the two deploy-only bugs that surfaced along the way — both are
exactly the kind of thing that only shows up once real infrastructure is
involved, not in local dev.

Milestone 10 (v1.1) is done, deployed, and verified in production: the
public landing page, set/replace album cover, password reset, search
across albums, year-based browse-home rows, drag-to-reorder media, and
Stripe billing with paid-plan video ceilings are all real and live (see
"Browse experience", "Media & storage", "Password reset", and "Billing"
below for each). Getting billing working in production surfaced a real
bug worth knowing before touching schema again: two migrations had been
verified locally but never pushed to the cloud project (`supabase db
reset` only touches local Postgres) — see "Deploying to production"
below for the full story and the fix.

## Local backend (Supabase via Docker)

Postgres + Auth + Storage run locally through the Supabase CLI in Docker
containers — no cloud account needed for development. Connection details
are in `.env.local` (gitignored; `.env.example` documents the shape).

**Windows-specific quirk**: the Supabase CLI could not be installed on
Windows directly — the npm-distributed binary was blocked by this machine's
Application Control policy (likely Algonquin IT-managed). It's installed
instead *inside* a WSL2 Ubuntu distro at `~/.local/bin/supabase`, with
Docker Desktop's WSL integration enabled for that distro. Practical
consequences:

- Run `supabase`/`docker` commands through WSL, e.g.:
  ```bash
  wsl -d Ubuntu -- bash -lc 'export PATH="$HOME/.local/bin:$PATH"; cd /mnt/c/Users/Admin/Website/gunita; supabase status'
  ```
- Inline quoting through PowerShell → `wsl` → `bash` is fragile (Windows
  `PATH` entries like `Program Files (x86)` contain parentheses that break
  naive inline commands). Prefer writing a small `.sh` file and running
  `wsl -d Ubuntu -- bash /mnt/c/path/to/script.sh` instead of one long
  inline command.
- The project directory is reachable from WSL at
  `/mnt/c/Users/Admin/Website/gunita`.

Local endpoints once `supabase start` has been run:
- API: `http://127.0.0.1:54321`
- Studio (DB/table browser): `http://127.0.0.1:54323`
- Mailpit (catches auth emails — password reset, invites): `http://127.0.0.1:54324`
- Postgres: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

### Schema & client

- Schema lives in `supabase/migrations/*.sql` (`init_schema`, `profiles`/
  `albums`/`album_members`/`media`; `refine_role_policies`, the full
  Owner/Admin/Editor/Viewer matrix from `docs/PRD.md` §4;
  `fix_rls_helper_volatility`, see the RLS gotcha below). To change it: add
  a **new** migration rather than editing an applied one (`supabase
  migration new <name>`, run from WSL), then apply with `supabase db reset`
  (safe pre-launch — it drops and recreates the local DB from migrations,
  no data to lose yet).
- **`supabase db reset` only ever touches the local database — it says
  nothing about production.** Two migrations (`add_media_sort_order`,
  `add_stripe_billing_fields`) shipped, got verified thoroughly against
  local Postgres, got committed, and sat unpushed to the linked cloud
  project for over a week before anyone noticed — because every local
  check kept passing, there was no signal that anything was missing until
  a real production request hit `column profiles.stripe_customer_id does
  not exist`. `supabase migration list` shows a `remote` column blank for
  anything that hasn't reached the cloud project; run it before assuming
  "it's committed" means "it's deployed," and run `supabase db push`
  (from wherever the CLI is actually logged in — WSL and Windows-native
  `npx supabase` are separate login sessions on this machine, see below)
  as part of shipping any migration, not as an afterthought at next
  deploy.
- RLS is the real enforcement for the role matrix — not just UI
  conditionals. `CAN_EDIT`/`CAN_MANAGE_MEMBERS` in `src/lib/albums/types.ts`
  gate the UI to match, but the DB would reject an unauthorized mutation
  either way.
- **RLS gotcha, worth knowing before adding another trigger-dependent
  policy**: `is_album_member`/`album_role` (the helper functions RLS
  policies call) are `VOLATILE`, not `STABLE`, on purpose. `STABLE` let
  Postgres reuse a cached result from *before* `handle_new_album` (an AFTER
  INSERT trigger) had run, so `INSERT INTO albums ... RETURNING id` failed
  its own SELECT-policy check even though the row was valid — reproduced
  directly against Postgres, see `fix_rls_helper_volatility` and
  `src/lib/albums/actions.ts`'s `createAlbum` (which also sidesteps it by
  generating the id client-side instead of relying on `RETURNING`). If a
  new insert needs `RETURNING` and depends on a same-statement trigger
  side-effect for its SELECT policy, expect to hit this again.
- Looking up another user by email (for invites) has to go through
  `admin.ts`, not `server.ts` — "profiles are viewable by album co-members"
  is exactly false for someone not yet invited. See `inviteMember` in
  `src/lib/albums/actions.ts`.
- A route param that isn't a valid uuid (stale bookmark, typo, a crawler
  probing paths) isn't a "not found" by default — Postgres rejects it
  before RLS even runs, as error code `22P02`
  (`invalid_text_representation`), and a bare `if (error) throw error;`
  turns that into an unhandled 500. `getAlbumDetail` (`src/lib/albums/
  queries.ts`) special-cases `22P02` into a `null` return, same as a
  real "no such album," so the page's existing `notFound()` handles it.
  Found via a golden-path smoke test hitting a malformed `/album/[id]`
  URL by accident — worth checking for the same pattern in any new query
  that takes a route param straight into an `.eq("id", ...)`.
- After any schema change, regenerate types: `supabase gen types
  typescript --local > src/lib/supabase/types.ts` (run from WSL).
- App-side clients are in `src/lib/supabase/`: `client.ts` (browser),
  `server.ts` (Server Components/Actions — respects RLS as the signed-in
  user), `admin.ts` (secret-key client that **bypasses RLS** — server-only,
  reserved for things RLS can't express, like the invite-lookup above or
  the future purge job), and `middleware.ts` (session-cookie refresh, wired
  up via `src/proxy.ts` — Next.js 16 renamed the `middleware.ts` convention
  to `proxy.ts`; don't reintroduce a root `middleware.ts`).
- Album/media server actions live in `src/lib/albums/` (`queries.ts` for
  reads, `actions.ts` for mutations, `types.ts` for the shared shapes) —
  follow this split for future domains rather than inventing a new pattern.

### Media & storage

- Photos/videos live in a **private** Supabase Storage bucket (`media`,
  declared in `supabase/config.toml`), not Cloudinary — see `PLANNING.md`
  for why that changed from the original plan. Objects are stored at
  `{album_id}/{media_id}.{ext}`; RLS on `storage.objects`
  (`add_media_storage` migration) reuses the same `album_role`/
  `is_album_member` helpers as the DB tables, so there's one definition of
  "who can see/upload/delete this album's stuff," not two.
- The `media` table stores **paths**, not URLs (`storage_path`,
  `thumbnail_storage_path` — renamed from `url`/`thumbnail_url` in
  `rename_media_url_to_storage_path`, since a private bucket has no public
  URL to store). Signed URLs are generated on demand at read time via
  `src/lib/storage/media.ts` (`getSignedMediaUrl`/`getSignedMediaUrls`),
  never persisted.
- No Cloudinary/ffmpeg/sharp means no server-side transcoding or
  thumbnailing. Thumbnails are generated **client-side** on canvas
  (`src/lib/media/client-thumbnails.ts`) before upload — for video, this
  means decoding real video metadata (duration/dimensions) in the browser
  to enforce the 1080p/5-min caps, then seeking and drawing a frame. HEIC
  can fail to canvas-draw in Chromium/Firefox; that's handled as "no
  thumbnail," not a failed upload.
- The upload endpoint (`src/app/api/media/upload/route.ts`) is a **Route
  Handler**, not a Server Action — Server Actions default to a ~1MB body
  limit, which a video cap of 1 GB blows through immediately.
- Storage quota (`src/lib/storage/quota.ts`) uses **decimal GB** (10^9
  bytes), matching how storage limits are conventionally advertised —
  not binary GiB. `getStorageUsageBytes` sums every `media` row for an
  uploader with no `deleted_at` filter on purpose: soft-deleted media
  still counts against the cap until the purge job (below) removes it
  for real (docs/PRD.md §7).
- **Two real bugs hit while building this, both worth knowing before
  touching upload/media code again:**
  - Next's Image Optimizer refuses to fetch from private-IP hosts by
    default (SSRF protection) — exactly what `127.0.0.1:54321` (local
    Supabase Storage) is. Fixed with `images.dangerouslyAllowLocalIP =
    true` in `next.config.ts`. Harmless for a deployed Supabase project
    (real hostname), but don't remove it while still developing locally.
  - Next's **middleware** has a ~10MB body-read cap, and `src/proxy.ts`'s
    matcher originally covered `/api/*` too — any upload over 10MB was
    silently truncated, producing a confusing `TypeError: Failed to parse
    body as FormData` / `500` instead of a clean rejection. Fixed by
    excluding `api/` from the proxy matcher, which is also just the
    correct design: an API route should return a 401 JSON body on an
    auth failure, not an HTML redirect to `/sign-in`. If a new route
    handler needs middleware-driven auth redirects, it needs a different
    mechanism than the shared proxy matcher.
- **Album cover**: the first upload to an album becomes its cover
  automatically (route handler, `src/app/api/media/upload/route.ts`), but
  it's changeable afterward — `setAlbumCover` in `src/lib/albums/
  actions.ts`, surfaced as a "Set as cover"/"Cover" control on each
  `MediaTile` in `MediaUploader.tsx` (owner/admin/editor only, same
  `canEdit` gate as everything else in that component). Only photos are
  eligible — a video's `storage_path` points at the video file, not
  something `next/image` can render — enforced both by hiding the control
  for video tiles and by the action itself rejecting a non-photo id
  server-side. Deleting the current cover photo clears `cover_media_id`
  back to null (already existed in `deleteMedia`, `src/lib/media/
  actions.ts`); nothing auto-picks a replacement.

### Deletion & recovery

- Restore permissions deliberately **mirror delete permissions** rather
  than tracking who deleted what: album restore is owner-only (same RLS
  policy that allows delete — `owner can delete or restore the album`
  already had no `WITH CHECK` distinguishing the two), and media restore
  uses the same owner/admin/editor check as media delete/edit. There's no
  `deleted_by` column — restoring isn't scoped to "the person who deleted
  it," it's scoped to "anyone who could delete it in the first place."
- `/recently-deleted` (`src/app/recently-deleted/page.tsx`) is a
  **personal** view, not album-wide: it lists albums the user *owns* and
  media the user *uploaded*, mirroring how the storage-quota page is also
  uploader-scoped. An editor could restore a co-editor's deletion via RLS,
  but won't see it listed on their own Recently Deleted page.
- The hard-purge job (`src/app/api/cron/purge/route.ts`) uses
  `src/lib/supabase/admin.ts` on purpose — it has to act across every
  account's `purge_at`-expired rows, which is exactly what RLS is supposed
  to block for a normal request. It deletes Storage objects **before**
  the DB rows: for an expired album, that means fetching every remaining
  media row's paths (not just already-soft-deleted ones — the whole album
  is going) and removing them from Storage first, since deleting the
  `albums` row only cascades the `album_members`/`media` DB rows via FK,
  not the actual Storage objects.
- Wired to run via Vercel Cron (`vercel.json`, daily). `CRON_SECRET` gates
  the route when set; it's intentionally unset in `.env.local` so it can
  be called directly (`GET /api/cron/purge`, no header needed) for local
  testing — but it's a hard requirement in production, or the endpoint has
  no auth at all.

### Password reset

- The reset link's session doesn't arrive as a query param — Supabase's
  hosted `/auth/v1/verify` endpoint redirects to `redirectTo` with the
  recovery tokens in the URL **hash** (`#access_token=...`), which never
  reaches the server. `/reset-password` (`src/app/reset-password/
  page.tsx`) is a Client Component specifically so it can instantiate the
  Supabase browser client, whose `detectSessionInUrl` (on by default)
  picks the hash up, exchanges it for a session, and — because that
  client is the `@supabase/ssr` one, not vanilla `supabase-js` — also
  writes that session into cookies the server can see. `getSession()` is
  safe to call immediately on mount; it internally awaits that exchange
  rather than racing it.
- `/forgot-password` and `/reset-password` both had to be added to
  `PUBLIC_ROUTES` in `src/lib/supabase/middleware.ts` — without that,
  middleware would bounce a signed-out visitor away from `/reset-password`
  to `/sign-in` before the hash-exchange above ever got a chance to run,
  since the *first* request for that page genuinely has no session yet.
- `supabase/config.toml`'s `additional_redirect_urls` had to change from
  bare origins (`"http://localhost:3000"`) to wildcards
  (`"http://localhost:3000/**"`) — Supabase validates `redirectTo` as an
  exact match against this list, and `/reset-password` is a sub-path, not
  the bare origin. This needs pushing to the linked cloud project (`supabase
  config push`) too, not just applying locally, or the production reset
  link will fail with a "redirect_to not allowed" error that the bare-origin
  local config won't reproduce.
- `requestPasswordReset` (`src/lib/auth/actions.ts`) always reports success
  regardless of whether the email actually belongs to an account —
  Supabase itself never reveals that for this endpoint, and echoing a
  distinction back to the caller would let the form be used to enumerate
  registered emails. A real error from it means something like rate
  limiting, not "no such user."
- `updatePassword` is shared by both `/reset-password` (a recovery
  session) and the Account page's `ChangePasswordForm` (a normal signed-in
  session) — it just needs *a* valid session via `createClient()`'s
  cookies, and doesn't care which kind it is.

### Billing

- **Hosted Stripe Checkout, not embedded Elements**: `createCheckoutSession`
  (`src/lib/billing/actions.ts`) creates a Checkout Session and redirects
  to Stripe's own page — no client-side Stripe.js anywhere in this app,
  no PCI scope to worry about. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` exists
  in `.env.local` but nothing currently reads it; keep it that way unless
  a future feature genuinely needs Stripe.js in the browser.
- **The webhook (`src/app/api/stripe/webhook/route.ts`) is the only thing
  that writes `profiles.plan`** — never a click in this app. It reads the
  **raw** request body (`request.text()`, not `.json()`) because Stripe
  signs the exact bytes it sent; re-serializing a parsed object would
  almost never byte-for-byte match and signature verification would fail.
  Uses the admin client for the same reason as the purge job: Stripe
  calls this with no user session at all, which is exactly what RLS is
  supposed to block for a normal request.
- **A dormant RLS gap got closed while adding this, not because of
  anything Stripe-specific**: `add_stripe_billing_fields` drops "users
  can update their own profile" entirely. No app code has ever performed
  a client-authenticated `UPDATE` on `profiles` — only reads, plus the
  admin-client email lookup for invites — so that policy was a live but
  unused hole: anyone could already set their own `plan` to `'paid'`
  directly via the REST API with their own JWT. Harmless while `plan` did
  nothing; not harmless once it gates real storage/video limits. If a
  genuine self-service profile edit is ever added, it needs its own
  narrow policy — don't restore the old blanket one.
- **First upgrade vs. later upgrade**: `createCheckoutSession` doesn't
  create a Stripe Customer itself. On a first upgrade there's no
  `stripe_customer_id` yet, so `customer_email` lets Checkout create one
  and `client_reference_id: user.id` is how `checkout.session.completed`
  finds its way back to the right profile to save that new customer id.
  On a later upgrade (e.g. after a cancel-then-resubscribe) the saved
  customer id is reused instead. Once a customer id exists, subsequent
  `customer.subscription.*` events are matched by `stripe_customer_id`
  directly — they don't carry checkout-session metadata at all.
- **Verifying locally without the Stripe CLI**: this machine has no
  `stripe` CLI binary (only the `stripe` npm package), so there's no
  `stripe listen` to forward real webhook deliveries to localhost.
  `tests/integration/stripe-webhook.test.ts` signs its own synthetic
  events with `Stripe.webhooks.generateTestHeaderString()` — a real SDK
  helper, no network call to Stripe involved — using whatever
  `STRIPE_WEBHOOK_SECRET` is in `.env.local` (a local-only placeholder
  value is fine; it just needs to match between signer and verifier). For
  a stronger check than synthetic ids, a real Checkout was also completed
  once by hand and its *actual* `customer`/`subscription` ids were
  replayed through the same signing helper against the local server —
  same technique, real Stripe-issued ids instead of made-up ones.
- **Video ceilings are plan-gated in two places, not one**: the upload
  route (`src/app/api/media/upload/route.ts`) looks up the uploader's
  `profiles.plan` server-side (the real enforcement), and `MediaUploader`
  takes a `userPlan` prop so the client-side pre-upload check
  (`validateVideoMetadata`'s new optional `maxDurationSeconds` param,
  `src/lib/media/constraints.ts`) shows the right limit before spending
  upload time. It's always the *uploader's* plan, never the album
  owner's — matches `getStorageUsageBytes` already attributing usage to
  the uploader, not the album.
- **Per-file byte cap doesn't scale with plan**: `MAX_VIDEO_BYTES` stays
  45MB for paid accounts too — that number comes from the connected
  Supabase project's own free-tier Storage ceiling (Milestone 9), not
  from this app, and raising it for Gunita's paid tier wouldn't survive
  contact with Storage until that project is separately upgraded. See
  `src/lib/stripe/plans.ts` for the paid-tier constants and this caveat
  spelled out where someone's likely to look when the numbers stop
  matching intuition (a 10-minute 1080p video is often well over 45MB).

### Browse experience

- "Recently active" (the hero, and the default album order) is computed in
  `getAlbumsForCurrentUser` as `max(albums.updated_at, latest non-deleted
  media.created_at)`, not the query's own `ORDER BY updated_at` — a rename
  shouldn't outrank an actual upload for "active." The per-album latest-
  upload lookup and the hover-preview thumbnail lookup
  (`getPreviewsByAlbum`, up to 4 per album) are both separate queries in
  `src/lib/albums/queries.ts`, following the same pattern as
  `countActiveMediaByAlbum` — plain queries reduced in JS, not embedded
  PostgREST aggregates, given the count-with-filter bug from Milestone 3.
- `AlbumCard`'s hover-preview cycle mounts every preview thumbnail (once,
  on first hover/focus — see "Non-functional hardening" below) and
  crossfades between them via opacity, rather than swapping one `<Image>`'s
  `src`. The swap-`src` version was tried first and produced a visible
  blank flash on every tick, since each preview URL is a distinct signed
  URL the browser hasn't fetched yet.
- **Lightbox z-index gotcha**: the nav buttons in
  `src/components/albums/Lightbox.tsx` need explicit `z-10` — without it,
  the centered media element (which comes later in DOM order) paints over
  them wherever it's wide enough to reach the button positions, and clicks
  land on the media container's own (no-op) click handler instead of
  Prev/Next. Caught by actually clicking Next in the browser and watching
  the index not change, not by code review.
- **Search and year-based rows** (Milestone 10) live in
  `src/components/BrowseHome.tsx`, a Client Component `src/app/page.tsx`
  delegates to once it's fetched the data — search is a client-side
  substring filter over the already-fetched album list (title +
  description), not a new query, since it's one account's own albums, not
  a cross-account index; revisit if that scale assumption ever stops
  holding. Typing a query hides the hero/rows entirely in favor of a
  flat results grid; clearing it restores the normal view. Year rows
  replace the old unbounded "All albums" row, grouped by the same
  activity-date (`updatedAt`) that already drives the hero pick, newest
  year first — computed in `src/app/page.tsx` alongside the existing
  "Recently added"/"Shared" row logic.
- **Drag-to-reorder** (Milestone 10): `media.sort_order` (ascending =
  display order, `add_media_sort_order` migration) is the persisted
  order; `getAlbumMedia` orders by it instead of `created_at`. New
  uploads get `min(sort_order) - 1` (src/app/api/media/upload/route.ts)
  so they keep appearing first without renumbering the whole album on
  every upload — a manual reorder (`reorderMedia`,
  `src/lib/media/actions.ts`) resets the whole album to a clean
  `0..n-1` sequence anyway, so that gap never compounds. The drag itself
  is native HTML5 drag-and-drop on each `MediaTile`
  (`src/components/albums/MediaUploader.tsx`), not a library — set
  `draggable={false}` on the inner `next/image` specifically, since an
  `<img>` is natively draggable by default and will otherwise hijack the
  gesture from the tile's own `draggable` div. No keyboard-accessible
  alternative to dragging exists yet — a real gap, not an oversight to
  repeat elsewhere without noticing.
  - **Testing native HTML5 DnD**: `left_click_drag` (synthetic mouse
    events) does **not** trigger it — `dragstart`/`dragover`/`drop` need
    the browser's real drag gesture. Verify instead by dispatching actual
    `DragEvent`s via `javascript_tool`, but with a real `await sleep(...)`
    between each one: firing `dragstart` immediately followed by `drop`
    in the same synchronous script never gives React a chance to commit
    the `dragstart` handler's `setState` before the `drop` handler's
    closure reads it, so `drop` sees a stale `null` "what's being
    dragged" and silently no-ops. This isn't a bug in the app — it's
    exactly the same reason a *real* drag works fine (the user's mouse
    movement naturally spans multiple render cycles) and a same-tick
    synthetic one doesn't.

### Non-functional hardening

- **Server-side authorization audit** (Milestone 8): every server action in
  `src/lib/albums/actions.ts`/`src/lib/media/actions.ts`, both route
  handlers, and every RLS policy in `supabase/migrations/` were read
  through end to end looking for a mutation that only the UI, not the DB,
  was gating. None found — the app already followed "RLS is the actual
  boundary" consistently. The two places that bypass RLS
  (`inviteMember`'s admin-client email lookup; the purge cron) were
  already deliberate and documented (see "Schema & client" and "Deletion &
  recovery" above). This audit is now backed by `tests/integration/
  role-matrix.test.ts` rather than being a one-time read-through — see
  "Testing" below.
- **Hover-preview images are lazy, not just lazy-loaded**: `AlbumCard` used
  to mount all `previewUrls` `<Image>`s unconditionally the moment a card
  entered the viewport (relying on `loading="lazy"` to defer the actual
  fetch). That still meant every visible card fetched 4 extra thumbnails
  nobody might ever see. It now tracks `everHovered` and doesn't mount the
  preview images at all until the card is first hovered/focused — verified
  in the browser: a fresh page load has 3 `<img>` tags (hero + one card's
  cover), hovering that card adds exactly 4 more.
- **`prefers-reduced-motion`** is handled in two places, because one signal
  can't reach both: a global rule in `globals.css` zeroes out CSS
  transition/animation durations (covers the hover-scale, crossfade, and
  gradient-fade transitions), while the hover-preview's `setInterval`-based
  cycle — which CSS can't touch — checks a new `usePrefersReducedMotion`
  hook (`src/lib/use-reduced-motion.ts`) and simply doesn't cycle when the
  user has asked for reduced motion. That hook is built on
  `useSyncExternalStore`, not `useState`+`useEffect`: the naive version
  hit the `react-hooks/set-state-in-effect` lint rule *and* would have
  caused a hydration mismatch (server always renders `false`, since
  `matchMedia` doesn't exist server-side) — `useSyncExternalStore`'s
  `getServerSnapshot` param solves both at once.
- **Lightbox focus management**: opening it moves focus to the Close
  button (previously focus silently stayed on whatever was behind the
  dialog, or fell back to `<body>`); closing it — however triggered —
  restores focus to whatever element opened it, via
  `document.activeElement` captured before the dialog mounts. Tab/Shift+Tab
  are trapped inside the dialog's own focusable elements rather than
  escaping to the page behind it. Verified live: Shift+Tab from the Close
  button (the first focusable element) wrapped to Next (the last), and
  Escape returned focus to the exact MediaTile button that opened it.
- **Upload retry, not resumable upload**: true resumable (chunked/
  tus-style) upload was judged more complexity than this app's upload
  sizes justify. `MediaUploader`'s `UploadTask` now keeps the original
  `File` object, and a failed tile's new Retry button just resubmits it
  through the normal `uploadOne` path — same validation, same XHR, same
  progress UI, just re-triggered without the user re-picking the file.
- **First test suite** (Vitest): see "Testing" below.

When implementing real functionality, treat the PRD's phasing as the guide
for what belongs in this pass vs. later:
- **v1**: auth, private/shared albums with Owner/Admin/Editor/Viewer roles,
  upload, 15 GB free storage cap, 30-day Recently Deleted, the browse UI.
- **v1.1**: paid plans/billing, higher video ceilings, password reset,
  drag-to-reorder, search.
- **v2**: public link sharing, tagging, real-time collaboration.

Don't build v1.1/v2 features into the current pass unless explicitly asked.

### Deploying to production

Live at `gunita-photo-album.vercel.app`, Vercel project `gunita-photo-album`
under the `aira-de-castro` team, connected to cloud Supabase project
`dvzeqiavilidqpbvcdof`. Four real bugs only showed up once actual
infrastructure was involved — none of them were catchable by local dev,
build, lint, or the test suite, only by loading and using the live site:

- **Env vars present ≠ env vars working**: the first deploy attempt had
  all 5 Supabase env vars set in the Vercel dashboard, but every request
  500'd with `"Your project's URL and Key are required..."` — i.e. they
  were empty at runtime despite existing in the dashboard. Root cause
  was how they'd originally been created (Vercel's dashboard has two
  distinct env var types — legacy CLI-style "Secret" references vs.
  plain project-scoped values — and the legacy-style ones weren't
  reaching the build). Fixed by deleting and re-adding all 5 as plain
  values. If this ever recurs: don't assume the dashboard showing a var
  exists means the running app can see it — verify with an actual
  request, e.g. `vercel logs <deployment-url>` while hitting `/`.
- **`next.config.ts`'s image `remotePatterns` only had the local host**:
  see "Media & storage" above — `127.0.0.1:54321` was allowlisted, no
  cloud host ever was. Every thumbnail and the hero image rendered
  broken in production even after the env vars were fixed. Now
  wildcarded to `*.supabase.co` so this doesn't recur if the project ref
  ever changes or a staging project is added.
- **The cloud project's free-tier Storage has its own upload ceiling**
  (~50MiB) independent of anything this app enforces — well under the
  PRD's 1GB v1 video cap. `MAX_VIDEO_BYTES` in `src/lib/media/
  constraints.ts` is now 45MB, not 1GB, specifically because of this
  cloud project's plan, not a product decision — raising it later is a
  paid-plan/Storage-tier lever, document it there if it changes.
- **Two schema migrations shipped and got verified locally without ever
  reaching the cloud project** (`add_media_sort_order`,
  `add_stripe_billing_fields`) — `supabase db reset` only ever applies to
  the local database, and nothing forces a `supabase db push` alongside
  it. This sat unnoticed until a real Stripe checkout hit `column
  profiles.stripe_customer_id does not exist` in production. See the new
  bullet in "Schema & client" above — `supabase migration list`'s
  `remote` column is the actual source of truth for "did this reach
  production," not "is it committed." Fixed by pushing both migrations
  (`supabase db push`) — no data loss, both were purely additive
  (new columns, one dropped policy nothing depended on).

For what it's worth, Vercel's newer "Secret" vs "Config" env var type
(the redesigned dialog, not the legacy CLI-style reference from bullet
one above) **did** work correctly once tried — `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` as Secret type reached the running app fine. The
symptom that looked like a repeat of the first bug (checkout 500ing right
after switching those two to Secret type) turned out to be the migration
gap above, unrelated. Worth remembering next time something breaks right
after touching env var types: check the actual server log before assuming
history is repeating itself.

Given all four, treat "the build passed" and "it loaded once" as
insufficient proof a deploy actually works — the golden-path smoke test
(sign up → shared album → invite → upload → edit → delete → restore) is
what actually caught the second and third bugs above, run **against the
live URL**, not local dev, with fresh throwaway accounts. Billing
specifically was verified the same way: a real Checkout completion, a
real webhook delivery Stripe made on its own (no manual replay needed,
unlike local dev — production has a real reachable URL), a real Customer
Portal cancellation, and its real webhook flipping the plan back.

## Stack & conventions

- **Next.js (App Router) + TypeScript**, `src/` layout, path alias `@/*`.
- **Tailwind CSS v4** — CSS-first config in
  [`src/app/globals.css`](src/app/globals.css), no `tailwind.config.js`.
  Theme colors are defined as CSS custom properties (`--bg`, `--surface`,
  `--text`, `--accent`, etc.) and exposed to Tailwind via `@theme inline`, so
  use the semantic classes (`bg-bg`, `text-text-muted`, `bg-accent`, …) —
  never hardcode a hex color in a component.
- **Light/dark theming**: light values live on bare `:root`; dark values are
  redefined once under `@media (prefers-color-scheme: dark)`. There's no
  manual theme toggle — if one is added later, mirror the pattern used in the
  published PRD artifact (`:root[data-theme="dark"]` override) rather than
  inventing a new one.
- **Fonts**: Fraunces (display/headings, incl. the italic wordmark), Work
  Sans (body), IBM Plex Mono (labels, counts, roles, timestamps) — loaded via
  `next/font/google` in [`src/app/layout.tsx`](src/app/layout.tsx). Keep this
  pairing; it's shared with the PRD document's own styling for continuity.
- **Components** in `src/components/` are presentational and take typed
  props from `src/lib/mock-data.ts`'s `Album` type — no fetching logic lives
  in them yet, with one exception: `Navbar` is an async server component
  that reads the real signed-in user (it predates the rest of the album
  data being real). When album/media data arrives, prefer keeping that same
  prop shape where reasonable rather than reshaping every component.
- **Auth** lives in `src/lib/auth/actions.ts` (`signIn`, `signUp`, `signOut`
  server actions, each server-validating email format + the 8-char password
  minimum before calling Supabase). The sign-in page (`src/app/sign-in/page.tsx`)
  drives them via `useActionState`, not a form POST to a route handler.
  `?mode=sign-up` opens it straight on the Sign up tab (read via
  `useSearchParams`, which is why the page's default export is just a
  `Suspense` wrapper around the actual form component).
- **`/` is a public route** (`PUBLIC_ROUTES` in `src/lib/supabase/
  middleware.ts`), not gated like every other page. `src/app/page.tsx`
  branches on `auth.getUser()` itself: signed-out visitors get
  `src/components/Landing.tsx` (the marketing page), signed-in users get
  the real browse home. If you add a new genuinely-public route, add it to
  `PUBLIC_ROUTES` as an **exact path**, not a prefix — the middleware
  matches `PUBLIC_ROUTES.includes(pathname)`, deliberately not
  `startsWith`, because `"/"` as a prefix would match every route in the
  app.

## Key decisions already locked in (don't re-litigate without asking)

- Storage: **15 GB free per account**; a shared-album upload counts against
  the **uploader's** quota, not the album owner's.
- Video uploads: capped at **1080p / 5 minutes / 1 GB per file** in v1;
  higher limits are a paid-plan lever, not a v1 feature.
- Deletion: everything goes through a **30-day Recently Deleted** window
  before permanent purge; deleted items still count against quota during
  that window.
- Roles are **per-album**, not global: Owner > Admin > Editor > Viewer. Only
  the Owner can delete the album itself. See the table in `docs/PRD.md` §4
  for the exact capability matrix before changing any permission check.
- Sharing is **invite-based to specific accounts**, not public links (that's
  v2). Invites require the invitee to already have a Gunita account — there
  is no invite-link or non-member invite flow.
- When a member is removed from (or leaves) a shared album, the owner/admin
  decides whether that member's uploaded media stays or is removed with
  them — it's a per-removal choice, not an automatic rule.
- A plan downgrade gets a **30-day grace period** to shed storage before new
  uploads lock; existing over-cap media is never auto-deleted.
- An Admin can **never** remove or demote the Owner, even for an inactive
  account — that always requires support intervention outside the app.

## Testing

**Vitest** (`npm test`), chosen for zero-config TS/ESM support and speed —
no other test runner is in play. Two kinds of tests live in `tests/`:

- `tests/unit/` — pure functions only (`src/lib/media/constraints.ts`,
  `src/lib/storage/quota.ts`). No DB, no network, always run.
- `tests/integration/` — real signed-up test users against the *real*
  local Supabase Postgres, exercising actual RLS policies rather than
  mocking them. This is the only way to actually verify "RLS is the
  enforcement boundary" claims made throughout this file instead of just
  asserting it in prose. Requires `supabase start` to already be running
  (see "Local backend" above) — `tests/helpers/supabase-test-clients.ts`
  checks reachability first and the suites `describe.skipIf` themselves
  with a clear message if it isn't, rather than failing opaquely.
  - `role-matrix.test.ts` walks a member through viewer → editor → admin
    on a real album, asserting what each role can and can't do against
    the actual PRD §4 matrix — including the "admin can never remove the
    owner" rule, tested by directly attempting the delete and confirming
    it's a silent no-op (RLS `USING` excludes `role = 'owner'` entirely,
    so this is not an error — it's 0 rows matched).
  - `storage-cap.test.ts` seeds real `media` rows (including a
    soft-deleted one, since those still count against quota) and confirms
    the summed usage matches what `getStorageUsageBytes` itself would
    compute, then feeds that real number into `wouldExceedQuota` to check
    the exact-cap boundary.
  - Test users are created via `supabase.auth.admin.createUser` (real auth
    users, `email_confirm: true` so no Mailpit round-trip needed — local
    `enable_confirmations = false` means this isn't even required, but
    it's explicit) and deleted in `afterAll`; deleting the auth user
    cascades through `profiles` → `albums`/`album_members`/`media` via the
    existing FKs, so no separate cleanup query is needed.
  - A silent-no-op RLS denial (`UPDATE`/`DELETE` whose `USING` clause
    excludes the row) returns `{ data: null, error: null }`, not an error
    — only a `WITH CHECK` failure on a row that *did* match `USING` (or
    any `INSERT` check failure) throws. Get this backwards and a test
    asserting `error).not.toBeNull()` on the wrong kind of denial will
    fail confusingly; see the comments in `role-matrix.test.ts` for which
    is which and why, if writing a new one.
  - `stripe-webhook.test.ts` needs `npm run dev` running too, not just
    `supabase start` — it POSTs signed synthetic events at a real running
    route (`isDevServerReachable()` in the test helpers), since signature
    verification against an actual HTTP request is exactly the kind of
    thing that can look right calling the handler function directly and
    still fail for real (wrong header casing, body already consumed,
    etc). If `npm run dev` is on a non-default port, set `TEST_APP_URL`
    (e.g. `TEST_APP_URL=http://localhost:3001 npm test`) rather than
    editing the test — this came up for real when another local session
    already held port 3000.

## Open questions

None outstanding for v1 scope (see `docs/PRD.md` §10). If new ambiguities
come up while implementing, flag them here rather than silently deciding.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build — run before considering a change done
npm run lint     # eslint
npm test         # vitest — unit tests always run; integration tests need supabase start first
```

Supabase (run via WSL — see "Local backend" above):
```bash
supabase start   # start the local Postgres/Auth/Storage containers
supabase stop    # stop them
supabase status  # print URLs/keys again (also written to .env.local)
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
