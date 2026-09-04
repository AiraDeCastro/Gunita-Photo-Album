# Gunita

*Gunita* — Tagalog for memory. A private photo & video album app with a
Netflix-style, browse-first home screen: a featured hero, horizontally
scrolling rows of albums, and cards that lift and preview on hover.

See [`docs/PRD.md`](docs/PRD.md) for the full product requirements
(auth, sharing & roles, storage limits, deletion/recovery, phasing) and
[`CLAUDE.md`](CLAUDE.md) for implementation notes, gotchas, and locked-in
decisions if you're working on this codebase.

## Status

**v1 shipped**: live in production on Vercel, connected to a cloud
Supabase project. Auth, private/shared albums with Owner/Admin/Editor/
Viewer roles, photo & video upload, a real 15 GB/account storage cap, a
30-day Recently Deleted window, and the full browse experience (hero,
hover-preview rows, lightbox) are all implemented against a real Supabase
backend — nothing runs on mock data. Automated tests cover the pure
validation/quota logic and the role-permission matrix against real Row
Level Security policies, and the full golden path (sign up → shared album
→ invite → upload → edit → delete → restore) has been verified against
the live deployment itself, not just locally. See `CLAUDE.md`'s "Deploying
to production" section for a few deploy-specific gotchas worth knowing
before touching infra config.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- [Supabase](https://supabase.com) — Postgres, Auth, and Storage, with Row
  Level Security as the actual permission boundary (not just UI hiding)
- [Vitest](https://vitest.dev) for tests
- Fonts: Fraunces (display), Work Sans (body), IBM Plex Mono (labels/data)

## Prerequisites

- Node.js 20+ and npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — runs
  the local Supabase stack (Postgres, Auth, Storage) in containers
- The [Supabase CLI](https://supabase.com/docs/guides/cli)
  - **Windows note**: the CLI can't always be installed directly on
    Windows (it may be blocked by Application Control policies). If so,
    install it inside WSL2 instead and run all `supabase`/`docker`
    commands from there — see the "Windows-specific quirk" callout in
    `CLAUDE.md`'s "Local backend" section for exact commands.

## Getting started

```bash
npm install
supabase start        # from WSL on Windows, see the prerequisites note above
```

`supabase start` prints local API/DB URLs and keys. Copy `.env.example` to
`.env.local` and fill it in with those values:

```bash
cp .env.example .env.local
```

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `supabase start` output, "API URL" |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `supabase start` output, "anon key" |
| `SUPABASE_SECRET_KEY` | `supabase start` output, "service_role key" — **server-only, never expose to the client** |
| `DATABASE_URL` | `supabase start` output, direct Postgres connection string |
| `CRON_SECRET` | Leave unset locally. Required in production — see "Deploying" below. |

Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up with any
email/password (local Supabase Auth doesn't send a real confirmation
email — Mailpit at `http://127.0.0.1:54324` catches anything it would send,
and email confirmation is disabled locally anyway).

## Testing

```bash
npm test
```

Unit tests (pure functions — storage-cap math, upload validation) always
run. Integration tests exercise the real role/permission matrix and
storage-cap logic against actual Row Level Security policies on the local
Postgres, so they need `supabase start` running first — they skip
themselves with a clear message if it isn't. See "Testing" in `CLAUDE.md`
for what each suite covers.

## Deploying

The app is built for [Vercel](https://vercel.com) (native Next.js support,
and `vercel.json` already wires up the daily Recently-Deleted purge via
Vercel Cron). Local development uses a Dockerized Supabase stack; a real
deploy needs a **cloud** Supabase project instead.

1. **Create a Supabase cloud project** at [supabase.com](https://supabase.com)
   (one for staging, one for production, if you want them separated).
   Push the schema to it:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
2. In the Supabase dashboard, create the `media` Storage bucket as
   **private** (matching `supabase/config.toml`'s local bucket config —
   it isn't created by `db push`, only tables/policies are).
3. **Connect the GitHub repo to a Vercel project**, then set these
   environment variables in the Vercel dashboard (Project Settings →
   Environment Variables) from your cloud project's API settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (mark it **sensitive** — this bypasses RLS)
   - `DATABASE_URL`
   - `CRON_SECRET` — generate a random secret and set it; **required in
     production**, since `/api/cron/purge` has no auth check at all
     without it (see `CLAUDE.md`'s "Deletion & recovery" section)
4. Deploy. Vercel Cron picks up the daily purge schedule from
   `vercel.json` automatically once the project is live.

## Project structure

```
src/
  app/
    page.tsx                    browse home (hero + rows)
    sign-in/                    combined sign in / sign up
    album/[id]/                 album detail: media grid, members, settings
    account/                    profile + live storage usage
    recently-deleted/           30-day deletion grace-window list
    api/media/upload/           upload route handler (large-body, bypasses proxy)
    api/cron/purge/             scheduled hard-purge job
  components/                   Navbar, Hero, AlbumRow, AlbumCard, Lightbox, ...
  lib/
    supabase/                   browser/server/admin clients + generated DB types
    albums/, media/, storage/   queries, mutations, and shared types per domain
tests/
  unit/                         pure-function tests (always run)
  integration/                  real-RLS tests against local Supabase
supabase/migrations/            schema + Row Level Security policies
docs/PRD.md                     product requirements
CLAUDE.md                       implementation notes, gotchas, locked-in decisions
TASKS.md                        milestone-by-milestone build log
```
