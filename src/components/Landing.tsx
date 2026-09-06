import Link from "next/link";

const FEATURES = [
  {
    title: "Browse, not scroll",
    body: "A hero pick, horizontally scrolling rows, and cards that lift and preview on hover — finding a memory feels like watching something, not searching a camera roll.",
  },
  {
    title: "Share with the right people",
    body: "Invite family and friends into an album as Owner, Admin, Editor, or Viewer — you decide who can add photos and who can only look.",
  },
  {
    title: "15 GB free, no card required",
    body: "Every account starts with 15 GB of free storage for photos and videos, enforced up front so you always know where you stand.",
  },
  {
    title: "Nothing's ever really gone",
    body: "Deleted albums and media wait 30 days in Recently Deleted before they're purged for good — plenty of time to change your mind.",
  },
];

export default function Landing() {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-accent-soft/50 via-bg to-bg">
        <div className="mx-auto max-w-2xl px-6 md:px-10 py-24 md:py-32 text-center">
          <p className="mb-4 font-mono text-xs uppercase tracking-wide text-text-muted">
            Tagalog for memory
          </p>
          <h1 className="font-display text-4xl md:text-6xl font-medium text-balance text-text">
            Your photos and videos, browsed like a story worth revisiting.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base md:text-lg text-text-muted">
            Gunita is a private photo &amp; video album app with a cinematic,
            browse-first home screen — inspired by Netflix, built for memories
            instead of a queue.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/sign-in?mode=sign-up"
              className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-accent-ink hover:opacity-90 transition-opacity"
            >
              Get started — it&apos;s free
            </Link>
            <Link
              href="/sign-in"
              className="text-sm text-text-muted hover:text-text transition-colors"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 pb-24">
        <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <h3 className="font-display text-lg text-text mb-1.5">{feature.title}</h3>
              <p className="text-sm text-text-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
