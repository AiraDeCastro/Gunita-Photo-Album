import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "?";

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 md:px-10 bg-gradient-to-b from-bg via-bg/80 to-transparent">
      <Link
        href="/"
        className="font-display italic text-2xl tracking-tight text-text"
      >
        Gunita
      </Link>
      <nav className="flex items-center gap-5 text-sm text-text-muted">
        <Link href="/" className="hover:text-text transition-colors">
          Browse
        </Link>
        <Link href="/recently-deleted" className="hover:text-text transition-colors">
          Recently Deleted
        </Link>
        {user ? (
          <Link
            href="/account"
            className="h-8 w-8 rounded-full bg-accent text-accent-ink flex items-center justify-center text-xs font-mono"
            aria-label="Account"
            title={user.email}
          >
            {initials}
          </Link>
        ) : (
          <Link href="/sign-in" className="hover:text-text transition-colors">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
