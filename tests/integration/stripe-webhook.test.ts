import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import {
  DEV_SERVER_URL,
  adminClient,
  createTestUser,
  deleteTestUser,
  isDevServerReachable,
  isSupabaseReachable,
  type TestUser,
} from "../helpers/supabase-test-clients";

/**
 * Exercises the real webhook route (`src/app/api/stripe/webhook/route.ts`)
 * over HTTP, not just its exported handler in isolation — signature
 * verification is exactly the kind of thing that looks right in a unit
 * test and still fails against a real request (wrong header name, body
 * already consumed/re-serialized, etc). Needs `npm run dev` running in
 * addition to `supabase start`, since this hits a live route, not just
 * the DB — skips itself with a clear reason if either isn't up.
 *
 * Events are synthetic, signed locally with whatever STRIPE_WEBHOOK_SECRET
 * is in .env.local (see that file's comment) via Stripe's own
 * generateTestHeaderString helper — this never talks to Stripe's API, so
 * it needs no network access and works the same whether or not the
 * configured secret matches a real webhook endpoint.
 */

const reachable = (await isSupabaseReachable()) && (await isDevServerReachable());

function signedRequest(payload: object) {
  const body = JSON.stringify(payload);
  const header = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
  return { body, header };
}

async function postWebhook(body: string, signature: string) {
  return fetch(`${DEV_SERVER_URL}/api/stripe/webhook`, {
    method: "POST",
    headers: { "stripe-signature": signature, "content-type": "application/json" },
    body,
  });
}

describe.skipIf(!reachable)("Stripe webhook -> profiles.plan sync", () => {
  let user: TestUser;
  const customerId = `cus_test_${randomUUID().slice(0, 12)}`;
  const subscriptionId = `sub_test_${randomUUID().slice(0, 12)}`;

  beforeAll(async () => {
    user = await createTestUser("stripe");
  }, 30_000);

  afterAll(async () => {
    await deleteTestUser(user.id);
  });

  it("rejects a request with an invalid signature", async () => {
    const res = await postWebhook(
      JSON.stringify({ id: "evt_bad", type: "checkout.session.completed" }),
      "t=1,v1=deadbeef",
    );
    expect(res.status).toBe(400);
  });

  it("checkout.session.completed sets plan=paid and saves the Stripe ids", async () => {
    const { body, header } = signedRequest({
      id: "evt_test_checkout",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          object: "checkout.session",
          client_reference_id: user.id,
          customer: customerId,
          subscription: subscriptionId,
        },
      },
    });

    const res = await postWebhook(body, header);
    expect(res.status).toBe(200);

    const { data: profile } = await adminClient()
      .from("profiles")
      .select("plan, stripe_customer_id, stripe_subscription_id")
      .eq("id", user.id)
      .single();
    expect(profile?.plan).toBe("paid");
    expect(profile?.stripe_customer_id).toBe(customerId);
    expect(profile?.stripe_subscription_id).toBe(subscriptionId);
  });

  it("customer.subscription.deleted sets plan back to free", async () => {
    const { body, header } = signedRequest({
      id: "evt_test_sub_deleted",
      object: "event",
      type: "customer.subscription.deleted",
      data: {
        object: {
          object: "subscription",
          id: subscriptionId,
          customer: customerId,
          status: "canceled",
        },
      },
    });

    const res = await postWebhook(body, header);
    expect(res.status).toBe(200);

    const { data: profile } = await adminClient()
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    expect(profile?.plan).toBe("free");
  });
});
