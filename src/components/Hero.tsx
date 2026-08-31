import Image from "next/image";
import Link from "next/link";
import type { Album } from "@/lib/mock-data";

export default function Hero({ album }: { album: Album }) {
  return (
    <div className="relative h-[52vh] min-h-[320px] w-full">
      <Image
        src={album.cover}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-black/20" />
      <div className="absolute inset-x-0 bottom-0 px-6 md:px-10 pb-10 max-w-xl">
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-white/80">
          Recently active
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-medium text-white text-balance drop-shadow-sm">
          {album.title}
        </h1>
        <p className="mt-2 text-sm text-white/80">
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
