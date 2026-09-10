// Paid tier (Milestone 10/v1.1): 100 GB storage, videos up to 1080p / 10
// minutes, $5/mo. The per-file byte cap is deliberately NOT raised for
// paid accounts — see MAX_VIDEO_BYTES in src/lib/media/constraints.ts,
// which is capped by the connected Supabase project's own free-tier
// Storage ceiling (~50MiB), not by anything this app enforces. A paid
// Gunita account still can't upload a single file bigger than that until
// the Supabase project itself is on a paid Storage plan — a separate
// upgrade from the one this file is about.
export const PAID_TIER_BYTES = 100_000_000_000;
export const PAID_MAX_VIDEO_DURATION_SECONDS = 10 * 60;
