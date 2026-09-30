"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/media/types";

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Lightbox({
  media,
  index,
  origin,
  onClose,
  onNavigate,
}: {
  media: MediaItem[];
  index: number;
  /** The clicked thumbnail's rect, for the opening FLIP animation below — omit for no origin-aware animation (just the backdrop fade). */
  origin?: DOMRect | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const item = media[index];
  const hasPrev = index > 0;
  const hasNext = index < media.length - 1;
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const [backdropVisible, setBackdropVisible] = useState(false);

  // Backdrop: simple opacity fade on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setBackdropVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Media container: a FLIP animation growing from the clicked thumbnail's
  // on-screen position/size to the dialog's centered layout, rather than
  // popping in already full-size. Runs once, on mount only (not on every
  // Next/Prev navigation, which re-renders this same component with a new
  // `index` but no new `origin` to animate from) — imperative style
  // manipulation via ref, not React state, since this is a one-shot
  // transient animation, not something that should re-trigger on re-render.
  // prefers-reduced-motion is still respected: globals.css's `*` rule
  // zeroes out `transition-duration` with `!important`, which beats the
  // inline `transition` shorthand set below (important always wins over
  // inline styles, regardless of origin).
  useLayoutEffect(() => {
    const el = mediaContainerRef.current;
    if (!el || !origin) return;
    const final = el.getBoundingClientRect();
    if (final.width === 0 || final.height === 0) return;
    const scaleX = origin.width / final.width;
    const scaleY = origin.height / final.height;
    const translateX = origin.left + origin.width / 2 - (final.left + final.width / 2);
    const translateY = origin.top + origin.height / 2 - (final.top + final.height / 2);
    el.style.transition = "none";
    el.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
    void el.offsetWidth; // force layout so the line above applies before the next frame flips it back
    requestAnimationFrame(() => {
      el.style.transition = "transform 320ms cubic-bezier(0.2, 0, 0, 1)";
      el.style.transform = "translate(0, 0) scale(1, 1)";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only, intentionally ignores `origin`/`index` changes on Next/Prev
  }, []);

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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 transition-opacity duration-200 ${backdropVisible ? "opacity-100" : "opacity-0"}`}
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
        ref={mediaContainerRef}
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
