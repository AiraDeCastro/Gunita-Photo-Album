"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [createOpen, setCreateOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
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

  // "/" focuses search, "n" opens the new-album form, and arrow keys move
  // focus between cards in whichever row currently has one — a roving
  // carousel-nav feel that fits the Netflix-style browsing this whole page
  // is already going for. All three back off the moment focus is inside
  // any text input (isTyping) so they never hijack normal typing; the
  // arrow-key case additionally only fires when focus is already on a
  // card (via the [data-album-card] check), so it never fights a text
  // input's own cursor-movement arrow keys.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (
        (e.key === "n" || e.key === "N") &&
        !isTyping &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setCreateOpen(true);
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const card = target?.closest<HTMLElement>("[data-album-card]");
        const row = card?.closest<HTMLElement>("[data-album-row]");
        if (!card || !row) return;
        const cards = Array.from(row.querySelectorAll<HTMLElement>("[data-album-card]"));
        const currentIndex = cards.indexOf(card);
        const next = cards[currentIndex + (e.key === "ArrowRight" ? 1 : -1)];
        if (next) {
          e.preventDefault();
          next.focus();
          next.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {!needle && <Hero album={featured} />}

      <div className="flex flex-wrap items-center justify-between gap-3 px-6 md:px-10 pt-6">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your albums… (press /)"
          aria-label="Search albums"
          className="w-full max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
        <CreateAlbumForm open={createOpen} onOpenChange={setCreateOpen} />
      </div>

      {needle ? (
        <div className="px-6 md:px-10 pt-6 pb-16">
          <h2 className="mb-3 text-sm font-mono uppercase tracking-wide text-text-muted">
            {results.length} result{results.length === 1 ? "" : "s"} for &quot;{trimmed}&quot;
          </h2>
          {results.length === 0 ? (
            <p className="text-sm text-text-muted">No albums match that search.</p>
          ) : (
            <div data-album-row className="flex flex-wrap gap-3">
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
