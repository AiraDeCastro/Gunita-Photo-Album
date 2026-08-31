import Link from "next/link";

export default function Navbar() {
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
        <Link
          href="/account"
          className="h-8 w-8 rounded-full bg-accent text-accent-ink flex items-center justify-center text-xs font-mono"
          aria-label="Account"
        >
          YOU
        </Link>
      </nav>
    </header>
  );
}
