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

Auth is real (Milestone 2, done) — sign-up/sign-in/sign-out all go through
Supabase Auth, every route redirects signed-out users to `/sign-in`, and the
Navbar/Account page show the actual signed-in user. Everything else is
still **frontend-only against mock data**: album browsing, album detail,
and Recently Deleted all render from
[`src/lib/mock-data.ts`](src/lib/mock-data.ts), not the `albums`/`media`
tables. Buttons like "Upload", "Delete album", "Manage members", and
"Restore" render but aren't wired yet. Don't assume an album/media table
query exists anywhere in `src/` — that's Milestones 3–7.

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

- Schema lives in `supabase/migrations/*.sql` (currently one migration,
  `init_schema.sql`, defining `profiles`, `albums`, `album_members`,
  `media`). To change it: add a **new** migration rather than editing an
  applied one (`supabase migration new <name>`, run from WSL), then apply
  with `supabase db reset` (safe pre-launch — it drops and recreates the
  local DB from migrations, no data to lose yet).
- RLS is enabled on all four tables, but the policies are a **baseline**
  (coarse ownership/membership checks) — the full Owner/Admin/Editor/Viewer
  capability matrix from `docs/PRD.md` §4 is Milestone 3 work, layered on
  top rather than redone.
- After any schema change, regenerate types: `supabase gen types
  typescript --local > src/lib/supabase/types.ts` (run from WSL).
- App-side clients are in `src/lib/supabase/`: `client.ts` (browser),
  `server.ts` (Server Components/Actions — respects RLS as the signed-in
  user), `admin.ts` (secret-key client that **bypasses RLS** — server-only,
  reserved for things RLS can't express like the purge job), and
  `middleware.ts` (session-cookie refresh, wired up via `src/proxy.ts` —
  Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`; don't
  reintroduce a root `middleware.ts`).

When implementing real functionality, treat the PRD's phasing as the guide
for what belongs in this pass vs. later:
- **v1**: auth, private/shared albums with Owner/Admin/Editor/Viewer roles,
  upload, 15 GB free storage cap, 30-day Recently Deleted, the browse UI.
- **v1.1**: paid plans/billing, higher video ceilings, password reset,
  drag-to-reorder, search.
- **v2**: public link sharing, tagging, real-time collaboration.

Don't build v1.1/v2 features into the current pass unless explicitly asked.

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

## Open questions

None outstanding for v1 scope (see `docs/PRD.md` §10). If new ambiguities
come up while implementing, flag them here rather than silently deciding.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build — run before considering a change done
npm run lint     # eslint
```

Supabase (run via WSL — see "Local backend" above):
```bash
supabase start   # start the local Postgres/Auth/Storage containers
supabase stop    # stop them
supabase status  # print URLs/keys again (also written to .env.local)
```

There is no test suite yet. When adding one, note the choice here.
