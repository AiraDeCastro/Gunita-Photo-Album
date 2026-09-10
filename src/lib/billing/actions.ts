"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe/client";

async function siteOrigin(): Promise<string> {
  return (
    (await headers()).get("origin") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

/**
 * Starts a Stripe Checkout session for the paid plan and redirects there —
 * a hosted page, not embedded Elements, so there's no client-side Stripe.js
 * and no PCI scope for this app to worry about.
 *
 * Doesn't create the Stripe Customer itself: on a first upgrade there's no
 * `stripe_customer_id` yet, so `customer_email` lets Checkout create one,
 * and `client_reference_id` is how the webhook (`checkout.session.completed`)
 * finds its way back to this profile to save that new customer id. On a
 * later upgrade (e.g. after a downgrade) the existing customer is reused.
 */
export async function createCheckoutSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();
  if (error) throw new Error(error.message);

  const stripe = createStripeClient();
  const origin = await siteOrigin();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: profile.stripe_customer_id ?? undefined,
    customer_email: profile.stripe_customer_id ? undefined : (user.email ?? undefined),
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${origin}/account?checkout=success`,
    cancel_url: `${origin}/account?checkout=canceled`,
    client_reference_id: user.id,
  });

  if (!session.url) throw new Error("Could not start checkout.");
  redirect(session.url);
}

/** Stripe's hosted subscription-management page — cancel, update card, view invoices. */
export async function createBillingPortalSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();
  if (error) throw new Error(error.message);
  if (!profile.stripe_customer_id) throw new Error("No billing account found yet.");

  const stripe = createStripeClient();
  const origin = await siteOrigin();

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/account`,
  });

  redirect(session.url);
}
