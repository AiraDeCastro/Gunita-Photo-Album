import AlbumCard from "./AlbumCard";
import type { AlbumSummary } from "@/lib/albums/types";

export default function AlbumRow({
  label,
  albums,
}: {
  label: string;
  albums: AlbumSummary[];
}) {
  if (albums.length === 0) return null;

  return (
    <section className="mb-9">
      <h2 className="mb-3 px-6 md:px-10 text-sm font-mono uppercase tracking-wide text-text-muted">
        {label}
      </h2>
      <div className="flex gap-3 overflow-x-auto px-6 md:px-10 pb-2 [scrollbar-width:thin]">
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </div>
    </section>
  );
}
