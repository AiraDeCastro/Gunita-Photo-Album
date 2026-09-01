# Gunita — Product Requirements Document (v1.2)

*Gunita* — Tagalog for memory. A private photo & video album app with a
cinematic, browse-first home screen inspired by Netflix.

## 1. Overview

Gunita is a personal photo and video album web app. Users sign up, sign in,
and build a library of albums — uploading photos and videos, naming and
editing those albums, and revisiting them later.

The home screen borrows Netflix's browsing grammar — a hero at the top, and
rows of albums that scroll horizontally, with cards that lift and preview on
hover — applied to a warm, archival palette rather than a streaming brand.

## 2. Goals for v1

- Secure account creation, sign-in, and sign-out.
- Create, rename, and delete albums — both private and shared.
- Invite other accounts into an album as family/friends, with an owner able
  to control who can edit versus only view.
- Upload multiple photos and videos into an album, with progress feedback.
- Edit and delete individual media items and album metadata, with changes
  reliably saved.
- A 15 GB free storage allowance per account, enforced at upload time.
- A recovery window for deleted albums and media before anything is purged
  for good.
- A browse-first, Netflix-style home screen.

### Explicitly out of scope for v1

- Paid storage plans (conceptually designed, ships in v1.1).
- Public link sharing — a shared album is invite-based, not link-based.
- Photo editing (filters, cropping, rotation).
- Automatic tagging, facial recognition, or AI-generated suggestions.
- Native mobile apps.

## 3. Albums & sharing

Every album is **Private** (visible only to its creator) or **Shared**
(visible to invited members). An album can start private and be converted to
shared by inviting someone. Only the owner can delete the album itself; any
member with edit rights can rename it or manage its media.

Invites are limited to **existing Gunita accounts**, added by their account
email — there is no invite-link flow and no way to invite someone who
doesn't have an account yet. If that's a common case in practice, the
person is invited to sign up first, then added.

## 4. Roles & permissions

| Capability                       | Owner | Admin | Editor | Viewer |
|-----------------------------------|:-----:|:-----:|:------:|:------:|
| View media                        | ✓     | ✓     | ✓      | ✓      |
| Upload / edit / delete media       | ✓     | ✓     | ✓      | —      |
| Rename the album                  | ✓     | ✓     | ✓      | —      |
| Invite members, set their role     | ✓     | ✓     | —      | —      |
| Remove a member                   | ✓     | ✓*    | —      | —      |
| Delete the album                  | ✓     | —     | —      | —      |

\* an admin cannot remove the owner. This holds even in edge cases — an
inactive or unreachable Owner is not something an Admin can resolve inside
the app; it always requires support intervention outside normal roles.

## 5. Upload & media

- Photos: JPEG, PNG, HEIC, WebP, up to 25 MB each.
- Video: MP4, MOV, WebM — up to **1080p**, **5 minutes**, **1 GB** per file
  in v1. Higher ceilings are reserved as a paid-plan upsell rather than a
  hard rule, since 4K footage would fill a 15 GB free tier quickly.
- Drag-and-drop or file-picker multi-select, per-file progress, thumbnails
  generated for both photos and (first-frame) videos.

## 6. Storage & plans

- Every account starts with **15 GB** free.
- A file counts against the account that **uploaded** it, not the album
  owner — so one popular shared album can't drain one person's quota.
- Paid tiers (more storage, higher video ceilings) ship in v1.1.
- Downgrading from a paid plan back to free doesn't lock uploads
  immediately: the account gets a **30-day grace period** (matching the
  Recently Deleted window, for consistency) to bring usage under 15 GB
  before new uploads are blocked. Existing media over the cap is never
  deleted automatically.

## 7. Deletion & recovery

- Deleting anything moves it to **Recently Deleted** instead of erasing it
  immediately — restorable for **30 days**, then purged automatically.
- Deleted items still count against the 15 GB quota during the grace window,
  so it can't be used to dodge the storage cap.
- Only the owner/admin can delete a shared album outright; any editor can
  delete individual media.
- When a member is removed from a shared album (or leaves on their own),
  the owner or an admin decides whether the media that member personally
  uploaded stays in the album or is removed with them — it's their call,
  not an automatic rule either way.

## 8. Non-functional requirements

- **Performance** — lazy-loaded thumbnails/hover previews; smooth scrolling
  at hundreds of albums.
- **Privacy & security** — every route checks the requester's *role*
  server-side, not just account ownership; media URLs are not guessable.
- **Reliability** — interrupted uploads can be resumed or retried.
- **Accessibility** — full keyboard navigation, visible focus states, alt
  text, respect for reduced-motion.

## 9. Phasing

| Phase | Scope |
|-------|-------|
| **v1** | Auth, private/shared album CRUD with Owner/Admin/Editor/Viewer roles, multi-file upload, 15 GB free storage cap, 30-day Recently Deleted, Netflix-style browse home, lightbox view. |
| **v1.1** | Paid storage plans & billing, higher video ceilings for paid accounts, password reset, drag-to-reorder media, search, year-based rows. |
| **v2** | Public link sharing (view-only), tagging/people grouping, real-time collaborative editing. |

## 10. Open questions

None outstanding for v1 scope — the four questions raised during drafting
(invite mechanism, removed-member media handling, downgrade grace period,
emergency Owner removal) are now resolved and folded into §3, §4, §6, and §7
above. Add new ones here as they come up rather than deciding silently.

---
*Full designed version: see the published PRD artifact linked from the
project conversation.*
