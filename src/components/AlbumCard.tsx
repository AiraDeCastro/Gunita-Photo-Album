import Image from "next/image";
import Link from "next/link";
import type { Album } from "@/lib/mock-data";

export default function AlbumCard({ album }: { album: Album }) {
  return (
    <Link
      href={`/album/${album.id}`}
      className="group relative w-44 md:w-52 shrink-0 rounded-md overflow-hidden bg-surface-sunken transition-transform duration-200 ease-out hover:scale-105 hover:z-10 focus-visible:scale-105 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="relative aspect-video">
        <Image
          src={album.cover}
          alt=""
          fill
          sizes="(max-width: 768px) 176px, 208px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        {album.type === "shared" && (
          <span className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-white">
            Shared
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-sm font-medium leading-tight truncate text-text">
          {album.title}
        </p>
        <p className="text-xs text-text-muted font-mono">{album.itemCount} items</p>
      </div>
    </Link>
  );
}
