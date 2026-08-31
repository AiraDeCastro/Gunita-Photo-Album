import Navbar from "@/components/Navbar";
import { albums } from "@/lib/mock-data";

const deleted = [
  { title: albums[4].title, kind: "Album", daysLeft: 24 },
  { title: "IMG_2381.jpg", kind: "Photo · Beach Weekend", daysLeft: 12 },
  { title: "clip_0007.mp4", kind: "Video · Lake House", daysLeft: 3 },
];

export default function RecentlyDeletedPage() {
  return (
    <div className="flex-1">
      <Navbar />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-3xl font-medium text-text mb-2">
          Recently Deleted
        </h1>
        <p className="text-sm text-text-muted mb-8">
          Items are kept for 30 days before they&apos;re purged for good.
        </p>

        <ul className="flex flex-col divide-y divide-border rounded-md border border-border overflow-hidden">
          {deleted.map((item) => (
            <li
              key={item.title}
              className="flex items-center justify-between gap-4 bg-surface px-4 py-3"
            >
              <div>
                <p className="text-sm text-text">{item.title}</p>
                <p className="text-xs text-text-muted">{item.kind}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-xs text-text-faint">
                  {item.daysLeft}d left
                </span>
                <button className="rounded-md border border-border px-3 py-1.5 text-xs text-text hover:bg-surface-sunken transition-colors">
                  Restore
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
