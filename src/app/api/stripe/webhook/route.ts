import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe calls this directly (no browser session, no cookies) whenever a
 * subscription's state changes — the source of truth for `profiles.plan`
 * is Stripe, not any click in this app. Uses the admin client on purpose,
 * same reasoning as the purge job: this has to update a specific account's
 * row on a server-to-server request that was never signed in as that
 * account, which is exactly what RLS is supposed to block otherwise.
 *
 * Signature verification needs the raw request body — `request.text()`,
 * not `request.json()`, since Stripe signs the exact bytes it sent and
 * re-serializing a parsed object would almost never byte-for-byte match.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const stripe = createStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (userId) {
        const { error } = await supabase
          .from("profiles")
          .update({
            plan: "paid",
            stripe_customer_id: toId(session.customer),
            stripe_subscription_id: toId(session.subscription),
          })
          .eq("id", userId);
        if (error) throw error;
      }
      break;
    }

    // Covers both a cancellation (status flips to "canceled") and a
    // failed-payment lapse ("unpaid"/"past_due" past its retry window) —
    // both events carry the same Subscription object shape, so one branch
    // handles them by deriving "still paid" from `status` rather than the
    // event name.
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = toId(subscription.customer);
      if (customerId) {
        const stillActive = subscription.status === "active" || subscription.status === "trialing";
        const { error } = await supabase
          .from("profiles")
          .update({
            plan: stillActive ? "paid" : "free",
            stripe_subscription_id: stillActive ? subscription.id : null,
          })
          .eq("stripe_customer_id", customerId);
        if (error) throw error;
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}

function toId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}
