import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";

const usedGb = 6.4;
const totalGb = 15;
const usedPct = Math.round((usedGb / totalGb) * 100);

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex-1">
      <Navbar />
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="font-display text-3xl font-medium text-text mb-8">Account</h1>

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
            {usedGb} GB of {totalGb} GB used · Free plan
          </p>
          <button className="mt-3 rounded-md border border-accent px-4 py-2 text-sm text-accent hover:bg-accent-soft transition-colors">
            Upgrade plan
          </button>
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
          <button className="rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-sunken transition-colors">
            Change password
          </button>
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
