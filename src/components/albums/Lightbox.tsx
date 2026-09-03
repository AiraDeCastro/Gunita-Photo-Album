"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { MediaItem } from "@/lib/media/types";

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog on open, and back to whatever triggered it
  // (a MediaTile's open button) on close — otherwise keyboard focus would
  // silently land on <body>, the standard dialog a11y pitfall.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1);

      // Focus trap: Tab/Shift+Tab wraps within the dialog instead of
      // escaping to whatever's behind it.
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, hasPrev, hasNext, onClose, onNavigate]);

  if (!item) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.kind === "video" ? "Video" : "Photo"} ${index + 1} of ${media.length}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 px-3 py-2 text-sm text-white hover:bg-black/70 transition-colors focus-visible:outline-2 focus-visible:outline-accent"
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
          className="absolute left-2 md:left-4 z-10 rounded-full bg-black/50 px-3 py-4 text-lg text-white hover:bg-black/70 transition-colors focus-visible:outline-2 focus-visible:outline-accent"
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
          className="absolute right-2 md:right-4 z-10 rounded-full bg-black/50 px-3 py-4 text-lg text-white hover:bg-black/70 transition-colors focus-visible:outline-2 focus-visible:outline-accent"
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
              aria-label={`Video ${index + 1} of ${media.length}`}
              className="max-h-[85vh] max-w-[90vw] rounded-md"
            />
          )
        ) : (
          item.url && (
            <div className="relative h-[85vh] w-[90vw]">
              <Image
                src={item.url}
                alt={`Photo ${index + 1} of ${media.length}`}
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
