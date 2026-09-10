import Stripe from "stripe";

/**
 * Server-only Stripe client. Test-mode keys today (sk_test_...) — see
 * CLAUDE.md's "Billing" section before switching to live keys.
 */
export function createStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}
