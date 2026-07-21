"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribes to a `matchMedia` query via useSyncExternalStore (matching this
 * codebase's useTts.ts pattern for external mutable state), re-rendering on
 * every change — viewport resize, devtools responsive mode, rotation —
 * rather than reading it once at mount. Used by GlossCard to switch between
 * the desktop popover and the narrow-screen bottom sheet.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false // server snapshot: never narrow during SSR
  );
}
