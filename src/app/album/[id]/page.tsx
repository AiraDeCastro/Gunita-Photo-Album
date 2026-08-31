import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import { albums } from "@/lib/mock-data";

export function generateStaticParams() {
  return albums.map((album) => ({ id: album.id }));
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = albums.find((a) => a.id === id);
  if (!album) notFound();

  return (
    <div className="flex-1">
      <Navbar />
      <div className="px-6 md:px-10 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-text-muted mb-1">
              {album.type === "shared" ? "Shared album" : "Private album"}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-medium text-text">
              {album.title}
            </h1>
            <p className="text-sm text-text-muted mt-1">
              {album.itemCount} items · updated {album.updatedAt}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-sunken transition-colors">
              Upload
            </button>
            {album.type === "shared" && (
              <button className="rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-sunken transition-colors">
                Manage members
              </button>
            )}
            <button className="rounded-md border border-border px-4 py-2 text-sm text-text hover:bg-surface-sunken transition-colors">
              Edit title
            </button>
            <button className="rounded-md border border-accent px-4 py-2 text-sm text-accent hover:bg-accent-soft transition-colors">
              Delete album
            </button>
          </div>
        </div>

        {album.members && (
          <div className="mb-8 flex flex-wrap gap-2">
            {album.members.map((m) => (
              <span
                key={m.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-muted"
              >
                {m.name}
                <span className="font-mono uppercase text-[10px] text-accent">
                  {m.role}
                </span>
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: Math.min(album.itemCount, 10) }).map((_, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-md overflow-hidden bg-surface-sunken"
            >
              <Image
                src={album.cover}
                alt=""
                fill
                sizes="200px"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm text-text-faint">
          This is a scaffold — media grid shows placeholder tiles only.{" "}
          <Link href="/" className="text-accent hover:underline">
            Back to browse
          </Link>
        </p>
      </div>
    </div>
  );
}
