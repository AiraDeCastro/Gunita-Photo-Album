-- Stripe billing (Milestone 10/v1.1): links a profile to its Stripe
-- customer/subscription so the webhook handler knows which row to update.

alter table public.profiles
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text;

-- "users can update their own profile" (init_schema) had no column
-- restriction and no app code has ever actually used it — nothing
-- currently updates `profiles` through the RLS-respecting client, only
-- through admin.ts (the invite email lookup, which only SELECTs anyway).
-- That made it a dormant gap: anyone could already set their own `plan`
-- to 'paid' directly via the REST API with their own JWT, bypassing the
-- app entirely. Harmless while `plan` did nothing; not harmless now that
-- it gates real storage/video limits. Dropping it entirely rather than
-- narrowing it — there's no legitimate self-service profile edit today,
-- and the Stripe webhook handler (service-role client, bypasses RLS same
-- as the purge job) is the only thing that should ever change `plan` or
-- the two columns above.
drop policy "users can update their own profile" on public.profiles;
