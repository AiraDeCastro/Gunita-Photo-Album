# PLANNING.md

Living planning document for Gunita. Where [`docs/PRD.md`](docs/PRD.md)
defines *what* the product does, this file defines *how* it gets built.
Stack and tool choices below are **recommendations, not yet adopted in
code** — the scaffold currently only implements the rows marked *(in
place)*. Revisit this file as decisions firm up.

## 1. Vision

Most photo apps optimize for backup and search; opening them feels like
browsing a file system. Gunita optimizes for the moment someone actually
wants to revisit a memory — so the app borrows the one interaction pattern
proven to make browsing a big personal library enjoyable: Netflix's hero +
horizontal-row layout, with hover-preview cards as the app's signature
interaction.

Two things have to both be true for Gunita to succeed:

1. **It has to feel calm and beautiful to open**, not utilitarian — dark,
   warm, cinematic, restrained motion.
2. **It has to be trustworthy with people's memories** — private by
   default, safe to delete from (30-day recovery), predictable about
   storage, and clear about who can see or edit a shared album.

Everything in this document is in service of those two things, not of
maximizing feature surface.

## 2. Architecture

### 2.1 Shape of the system

```
                     ┌─────────────────────────┐
                     │        Browser            │
                     │  Next.js (App Router)     │
                     │  React Server + Client    │
                     │  Components · Tailwind v4 │
                     └────────────┬───────────────┘
                                  │ HTTPS
                     ┌────────────▼───────────────┐
                     │   Next.js server runtime   │
                     │  (route handlers / server   │
                     │   actions — hosted on       │
                     │   Vercel)                   │
                     └───┬───────────┬─────────┬───┘
                         │           │         │
             ┌───────────▼──┐ ┌──────▼─────┐ ┌─▼─────────────┐
             │  Auth +      │ │  Media      │ │  Scheduled     │
             │  Postgres DB │ │  pipeline   │ │  jobs (cron):  │
             │  (Supabase)  │ │  (Cloudinary│ │  purge expired │
             │  — users,    │ │  upload +   │ │  Recently      │
             │  albums,     │ │  transcode +│ │  Deleted items;│
             │  members,    │ │  thumbnails)│ │  recompute     │
             │  media rows, │ │             │ │  storage usage │
             │  deletions   │ │             │ │                │
             └──────────────┘ └─────────────┘ └────────────────┘
```

The Next.js server layer is the only thing that talks to the database, the
media pipeline, and billing directly — the browser never holds credentials
for those services. Row-level security in Postgres is the second line of
defense for the permission model in PRD §4, so a bug in server-side role
checks doesn't automatically mean cross-account data exposure.

### 2.2 Core subsystems

- **Auth** — email/password sign-up, sign-in, sign-out, password reset
  (PRD §Authentication). *(Not yet implemented — UI only.)*
- **Albums & permissions** — an `albums` table plus an `album_members`
  join table carrying `(album_id, user_id, role)`. Every album/media
  operation is a single permission lookup against that join table rather
  than scattered ownership checks. Role semantics are the PRD §4 matrix,
  not reinvented per-endpoint.
- **Media pipeline** — upload → validate (format, size, and for video:
  resolution/length caps from PRD §5) → store original → generate
  thumbnail (photos) or a transcoded 1080p proxy + first-frame thumbnail
  (video) → record the resulting URLs on the `media` row.
- **Storage accounting** — each `media` row's byte size is attributed to
  its *uploader*, not the album owner (PRD §6 decision). A user's used-GB
  is a sum query (or a maintained counter, if that query gets expensive),
  shown on the Account page and checked before accepting an upload.
- **Deletion & recovery** — delete is a soft flag (`deleted_at` +
  `purge_at = deleted_at + 30 days`) on albums and media, not a hard
  delete. A scheduled job hard-deletes rows and their storage objects past
  `purge_at`. Storage accounting counts soft-deleted items until they're
  purged (PRD §7).
- **Billing** *(v1.1)* — plan tier lives on the `users`/`accounts` row;
  Stripe is the source of truth for subscription state via webhooks, not
  something the app computes itself.

### 2.3 Data model sketch

```
users            (id, email, password_hash, plan, created_at)
albums           (id, owner_id, title, description, cover_media_id,
                  type[private|shared], deleted_at, purge_at)
album_members    (album_id, user_id, role[owner|admin|editor|viewer])
media            (id, album_id, uploader_id, kind[photo|video], url,
                  thumbnail_url, bytes, width, height, duration_seconds,
                  deleted_at, purge_at)
```

This is a sketch to reason about the permission and storage logic above —
not a migration to run as-is; refine it once an ORM/schema tool is chosen.

## 3. Technology stack

| Layer | Choice | Status | Why |
|---|---|---|---|
| Framework | Next.js (App Router) + TypeScript | **In place** | Server components suit a media-heavy, permission-gated app; one deploy target for UI and API. |
| Styling | Tailwind CSS v4 (CSS-first theme tokens) | **In place** | Already carries the light/dark, warm-archival design system from the PRD artifact. |
| Fonts | Fraunces / Work Sans / IBM Plex Mono via `next/font` | **In place** | Matches the PRD's own typography for continuity between doc and product. |
| Hosting | Vercel | Recommended | Native fit for Next.js; built-in cron for the purge job; preview deploys per PR. |
| Auth + Database | Supabase (Postgres + Auth) | **In place (local)** | One vendor for both; Postgres row-level security maps directly onto the per-album role model instead of re-implementing it in app code. Running locally via the Supabase CLI in Docker (see `CLAUDE.md`); a cloud project is only needed at deploy time. |
| Object storage / media pipeline | Cloudinary | Recommended | Upload, CDN delivery, thumbnailing, and video transcoding (enforcing the 1080p/5-min cap) in one API, avoiding a self-hosted ffmpeg worker for v1. |
| Transactional email | Resend | Recommended | Album-invite emails and any custom notification email; password-reset email can instead ride on Supabase Auth's built-in flow. |
| Billing *(v1.1)* | Stripe Billing | Recommended | Standard choice; webhook-driven plan state avoids the app tracking subscription logic itself. |
| Background jobs | Vercel Cron → route handler | Recommended | Runs the daily Recently-Deleted purge and any storage-recount job; no separate worker infra needed at this scale. |

Nothing here is locked — if you'd rather avoid a third-party media
processor (Cloudinary) or prefer a different DB/auth vendor (e.g. Firebase,
Neon + Auth.js), say so before this becomes the working assumption for
implementation.

## 4. Required tools list

### Already set up
- Node.js 20+ and npm
- Git, with this repo connected to
  [AiraDeCastro/Gunita-Photo-Album](https://github.com/AiraDeCastro/Gunita-Photo-Album)
- Docker Desktop, WSL2 (Ubuntu distro), and the Supabase CLI — running the
  local Postgres/Auth/Storage stack. See `CLAUDE.md` for the Windows-specific
  setup quirks (the CLI runs inside WSL, not natively on Windows)
- `.env.local` (gitignored) with local Supabase connection details;
  `.env.example` documents the shape for anyone else setting up the repo

### Needed before backend work starts
- A **Cloudinary** account (media upload, transcoding, CDN)
- A **Vercel** account (hosting + cron), with the GitHub repo connected
- A **Resend** account (invite emails) — can be deferred until sharing is
  implemented

### Needed only at deploy time
- A **Supabase** cloud project (Postgres + Auth) — local development uses
  the Dockerized CLI instead; a cloud project only matters once this ships
  somewhere other than this machine

### Needed later (v1.1+)
- A **Stripe** account (paid plans, test mode is enough until launch)

### Nice to have
- GitHub CLI (`gh`) — not currently installed locally; useful for PRs,
  issues, and Actions from the terminal
- An API client (Postman/Insomnia or plain `curl`) for exercising route
  handlers during backend development
