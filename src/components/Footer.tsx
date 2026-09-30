export default function Footer() {
  return (
    <footer className="border-t border-border px-6 py-6 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display italic text-lg text-text-muted">Gunita</span>
        <p className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Tagalog word for memory · © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
