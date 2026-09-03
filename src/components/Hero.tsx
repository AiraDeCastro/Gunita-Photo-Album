import Image from "next/image";
import Link from "next/link";
import type { AlbumSummary } from "@/lib/albums/types";

export default function Hero({ album }: { album: AlbumSummary }) {
  return (
    <div className="relative h-[38vh] min-h-[240px] md:h-[52vh] md:min-h-[320px] w-full bg-surface-sunken">
      {album.cover && (
        <Image
          src={album.cover}
          alt={`Cover photo for ${album.title}`}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}
      <div
        className={
          album.cover
            ? "absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-black/20"
            : "absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent"
        }
      />
      <div className="absolute inset-x-0 bottom-0 px-6 md:px-10 pb-6 md:pb-10 max-w-xl">
        <p
          className={`mb-2 font-mono text-xs uppercase tracking-wide ${album.cover ? "text-white/80" : "text-text-muted"}`}
        >
          Recently active
        </p>
        <h1
          className={`font-display text-3xl md:text-5xl font-medium text-balance drop-shadow-sm ${album.cover ? "text-white" : "text-text"}`}
        >
          {album.title}
        </h1>
        <p className={`mt-2 text-sm ${album.cover ? "text-white/80" : "text-text-muted"}`}>
          {album.itemCount} items · updated {album.updatedAt}
        </p>
        <Link
          href={`/album/${album.id}`}
          className="mt-5 inline-flex items-center rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90 transition-opacity"
        >
          Open album
        </Link>
      </div>
    </div>
  );
}
