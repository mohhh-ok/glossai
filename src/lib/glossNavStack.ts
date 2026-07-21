import type { WordLookupResult } from "./wordCache";

/**
 * One entry in a GlossCard's internal navigation stack: the word/phrase
 * looked up, the context it was looked up under, and whatever's been loaded
 * for it so far. `info`/`error` start out `null` (a genuine cache miss) or
 * already populated (a cache hit captured at push time by the caller) — the
 * component's fetch effect is what fills in `info`/`error` afterwards via
 * the "loaded"/"failed" actions below.
 */
export interface GlossNavEntry {
  id: number;
  word: string;
  context: string;
  info: WordLookupResult | null;
  error: string | null;
}

/**
 * Actions carry a caller-assigned `id` (rather than one generated inside the
 * reducer) so the reducer stays a pure function of its arguments — easy to
 * unit test without needing to fake/reset module-level counter state.
 */
export type GlossNavAction =
  | { type: "push"; id: number; word: string; context: string; cached: WordLookupResult | null }
  | { type: "pop" }
  | { type: "reset"; id: number; word: string; context: string; cached: WordLookupResult | null }
  | { type: "loaded"; id: number; info: WordLookupResult }
  | { type: "failed"; id: number; error: string };

/**
 * Pure reducer backing GlossCard's internal "dictionary-style" navigation:
 * clicking an English run inside the card pushes a new entry instead of
 * opening a new popover; the "← 戻る" button pops back to the previous one
 * without refetching (its `info`/`error` are still sitting in the popped-to
 * entry). Kept free of fetch/cache side effects so it's testable in
 * isolation — GlossCard is the only caller, and owns the actual
 * fetch("/api/word") + wordCache read/write around it.
 */
export function glossNavReducer(
  stack: GlossNavEntry[],
  action: GlossNavAction
): GlossNavEntry[] {
  switch (action.type) {
    case "push":
      return [
        ...stack,
        {
          id: action.id,
          word: action.word,
          context: action.context,
          info: action.cached,
          error: null,
        },
      ];
    case "pop":
      // Nothing to pop back to at depth 1 — GlossCard only shows the "←"
      // button at depth ≥ 2, but stay defensive rather than ever emptying
      // the stack.
      return stack.length > 1 ? stack.slice(0, -1) : stack;
    case "reset":
      return [
        {
          id: action.id,
          word: action.word,
          context: action.context,
          info: action.cached,
          error: null,
        },
      ];
    case "loaded":
      return stack.map((entry) =>
        entry.id === action.id ? { ...entry, info: action.info, error: null } : entry
      );
    case "failed":
      return stack.map((entry) =>
        entry.id === action.id ? { ...entry, error: action.error } : entry
      );
    default:
      return stack;
  }
}
