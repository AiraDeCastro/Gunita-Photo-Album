import Navbar from "@/components/Navbar";
import ChangePasswordForm from "@/components/account/ChangePasswordForm";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";
import { createBillingPortalSession, createCheckoutSession } from "@/lib/billing/actions";
import { formatBytes, getStorageUsageBytes, tierBytesForPlan } from "@/lib/storage/quota";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("plan").eq("id", user.id).single()
    : { data: null };
  const plan = profile?.plan ?? "free";
  const tierBytes = tierBytesForPlan(plan);

  const usedBytes = user ? await getStorageUsageBytes(user.id) : 0;
  const usedPct = Math.min(100, Math.round((usedBytes / tierBytes) * 100));

  return (
    <div className="flex-1">
      <Navbar />
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="font-display text-3xl font-medium text-text mb-8">Account</h1>

        {checkout === "success" && (
          <p className="mb-6 rounded-md border border-accent bg-accent-soft px-4 py-3 text-sm text-text">
            You&apos;re on the paid plan — thanks!
          </p>
        )}

        <section className="mb-8">
          <h2 className="text-sm font-mono uppercase tracking-wide text-text-muted mb-3">
            Storage
          </h2>
          <div className="h-2 w-full rounded-full bg-surface-sunken overflow-hidden">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-text-muted">
            {formatBytes(usedBytes)} of {formatBytes(tierBytes)} used ·{" "}
            {plan === "paid" ? "Paid plan" : "Free plan"}
          </p>
          {plan === "paid" ? (
            <form action={createBillingPortalSession}>
              <button className="mt-3 rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-sunken transition-colors">
                Manage billing
              </button>
            </form>
          ) : (
            <form action={createCheckoutSession}>
              <button className="mt-3 rounded-md border border-accent px-4 py-2 text-sm text-accent hover:bg-accent-soft transition-colors">
                Upgrade plan — $5/mo
              </button>
            </form>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-mono uppercase tracking-wide text-text-muted mb-3">
            Profile
          </h2>
          <label className="flex flex-col gap-1.5 text-sm text-text-muted mb-4">
            Email
            <input
              type="email"
              readOnly
              defaultValue={user?.email ?? ""}
              className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-accent"
            />
          </label>
          <ChangePasswordForm />
        </section>

        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-sunken transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
