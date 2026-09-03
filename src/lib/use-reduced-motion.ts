"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * Mirrors the `prefers-reduced-motion: reduce` CSS media query for JS-driven
 * motion that CSS alone can't stop — e.g. the setInterval-based hover-preview
 * cycle in AlbumCard. Pure CSS transitions/animations are handled globally
 * in globals.css instead.
 *
 * Uses useSyncExternalStore rather than a useState+useEffect pair: it's the
 * React-recommended primitive for syncing to a browser API like this one,
 * and it avoids both the "setState synchronously in an effect" lint error
 * and the hydration mismatch a naive effect-based version would produce
 * (server always renders `false`; this only reveals the real preference
 * after hydration, without a mismatch warning).
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
