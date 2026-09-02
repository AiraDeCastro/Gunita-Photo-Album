"use client";

import Image from "next/image";
import { useEffect } from "react";
import type { MediaItem } from "@/lib/media/types";

export default function Lightbox({
  media,
  index,
  onClose,
  onNavigate,
}: {
  media: MediaItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const item = media[index];
  const hasPrev = index > 0;
  const hasNext = index < media.length - 1;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, hasPrev, hasNext, onClose, onNavigate]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 px-3 py-2 text-sm text-white hover:bg-black/70 transition-colors"
      >
        Close
      </button>

      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index - 1);
          }}
          aria-label="Previous"
          className="absolute left-2 md:left-4 z-10 rounded-full bg-black/50 px-3 py-4 text-lg text-white hover:bg-black/70 transition-colors"
        >
          ‹
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index + 1);
          }}
          aria-label="Next"
          className="absolute right-2 md:right-4 z-10 rounded-full bg-black/50 px-3 py-4 text-lg text-white hover:bg-black/70 transition-colors"
        >
          ›
        </button>
      )}

      <div
        className="relative flex max-h-full max-w-full items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {item.kind === "video" ? (
          item.url && (
            <video
              src={item.url}
              controls
              autoPlay
              className="max-h-[85vh] max-w-[90vw] rounded-md"
            />
          )
        ) : (
          item.url && (
            <div className="relative h-[85vh] w-[90vw]">
              <Image
                src={item.url}
                alt=""
                fill
                sizes="90vw"
                className="object-contain"
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}
