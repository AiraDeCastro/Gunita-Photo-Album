import Navbar from "@/components/Navbar";
import RestoreButton from "@/components/RestoreButton";
import { getDeletedAlbums } from "@/lib/albums/queries";
import { getDeletedMedia } from "@/lib/media/queries";

export default async function RecentlyDeletedPage() {
  const [albums, media] = await Promise.all([getDeletedAlbums(), getDeletedMedia()]);

  const items = [
    ...albums.map((a) => ({
      key: `album-${a.id}`,
      title: a.title,
      subtitle: "Album",
      daysLeft: a.daysLeft,
      deletedAt: a.deletedAt,
      button: <RestoreButton kind="album" id={a.id} />,
    })),
    ...media.map((m) => ({
      key: `media-${m.id}`,
      title: m.kind === "video" ? "Video" : "Photo",
      subtitle: m.albumTitle,
      daysLeft: m.daysLeft,
      deletedAt: m.deletedAt,
      button: <RestoreButton kind="media" id={m.id} albumId={m.albumId} />,
    })),
  ].sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));

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

        {items.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing here.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border overflow-hidden">
            {items.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-4 bg-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm text-text">{item.title}</p>
                  <p className="text-xs text-text-muted">{item.subtitle}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-xs text-text-faint">
                    {item.daysLeft}d left
                  </span>
                  {item.button}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
