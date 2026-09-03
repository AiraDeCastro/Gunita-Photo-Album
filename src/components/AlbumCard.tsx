"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AlbumSummary } from "@/lib/albums/types";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

const CYCLE_MS = 700;

export default function AlbumCard({ album }: { album: AlbumSummary }) {
  const [hovering, setHovering] = useState(false);
  const [everHovered, setEverHovered] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const canCycle = hovering && !reducedMotion && album.previewUrls.length > 1;

  useEffect(() => {
    if (!canCycle) return;
    intervalRef.current = setInterval(() => {
      setPreviewIndex((i) => (i + 1) % album.previewUrls.length);
    }, CYCLE_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [canCycle, album.previewUrls.length]);

  const baseSrc = album.cover ?? album.previewUrls[0] ?? null;

  return (
    <Link
      href={`/album/${album.id}`}
      onMouseEnter={() => {
        setHovering(true);
        setEverHovered(true);
      }}
      onMouseLeave={() => {
        setHovering(false);
        setPreviewIndex(0);
      }}
      onFocus={() => {
        setHovering(true);
        setEverHovered(true);
      }}
      onBlur={() => {
        setHovering(false);
        setPreviewIndex(0);
      }}
      className="group relative w-44 md:w-52 shrink-0 snap-start rounded-md overflow-hidden bg-surface-sunken transition-transform duration-200 ease-out hover:scale-105 hover:z-10 focus-visible:scale-105 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="relative aspect-video">
        {baseSrc ? (
          <>
            {/* Base layer (the cover) — preview images only mount once the
                card has been hovered/focused at least once, so a page with
                many albums doesn't eagerly fetch 4 extra thumbnails per card
                that most visitors will never see. Once mounted they stay
                mounted, so cycling toggles opacity instead of swapping
                `src` (which caused a network refetch and blank flash per
                tick). */}
            <Image
              src={baseSrc}
              alt={`Cover photo for ${album.title}`}
              fill
              sizes="(max-width: 768px) 176px, 208px"
              className={`object-cover transition-opacity duration-300 ${hovering && album.previewUrls.length > 0 ? "opacity-0" : "opacity-100"}`}
            />
            {everHovered &&
              album.previewUrls.map((url, i) => (
                <Image
                  key={url}
                  src={url}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 176px, 208px"
                  className={`object-cover transition-opacity duration-300 ${hovering && i === previewIndex ? "opacity-100" : "opacity-0"}`}
                />
              ))}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">
              No photos yet
            </span>
          </div>
        )}
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
