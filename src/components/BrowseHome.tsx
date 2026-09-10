"use client";

import { useMemo, useState } from "react";
import Hero from "./Hero";
import AlbumRow from "./AlbumRow";
import AlbumCard from "./AlbumCard";
import CreateAlbumForm from "./albums/CreateAlbumForm";
import type { AlbumSummary } from "@/lib/albums/types";

/**
 * Client-side substring search over the already-fetched album list — no
 * extra round trip. Fine at this app's scale (one account's own albums,
 * not a cross-account index); revisit with a real server-side query if
 * that ever changes.
 */
export default function BrowseHome({
  featured,
  rows,
  albums,
}: {
  featured: AlbumSummary;
  rows: { label: string; albums: AlbumSummary[] }[];
  albums: AlbumSummary[];
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();

  const results = useMemo(() => {
    if (!needle) return [];
    return albums.filter(
      (album) =>
        album.title.toLowerCase().includes(needle) ||
        (album.description?.toLowerCase().includes(needle) ?? false),
    );
  }, [albums, needle]);

  return (
    <>
      {!needle && <Hero album={featured} />}

      <div className="flex flex-wrap items-center justify-between gap-3 px-6 md:px-10 pt-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your albums…"
          aria-label="Search albums"
          className="w-full max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
        <CreateAlbumForm />
      </div>

      {needle ? (
        <div className="px-6 md:px-10 pt-6 pb-16">
          <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-text-muted">
            {results.length} result{results.length === 1 ? "" : "s"} for &quot;{trimmed}&quot;
          </h2>
          {results.length === 0 ? (
            <p className="text-sm text-text-muted">No albums match that search.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {results.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="pt-4 pb-16">
          {rows.map((row) => (
            <AlbumRow key={row.label} label={row.label} albums={row.albums} />
          ))}
        </div>
      )}
    </>
  );
}
