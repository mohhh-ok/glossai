import type { WordInfo } from "./llm/schema";

/** /api/word's response shape: the generated/cached info plus whether it was served from the server-side SQLite cache. */
export interface WordLookupResult extends WordInfo {
  cached: boolean;
}

/**
 * Module-level cache keyed by word so re-clicking the same word/phrase in
 * the same reading session renders instantly instead of re-fetching
 * /api/word. Keyed by word alone (not by surrounding context) because
 * generation itself is context-free — see wordInfo's doc comment in
 * src/lib/llm/types.ts — so the same word looked up from two different
 * sentences is the same cache entry. This is separate from (and sits in
 * front of) the server-side SQLite cache in src/lib/wordStore.ts, which
 * persists across sessions/reloads and is keyed the same way (see
 * normalizeWordKey).
 */
const cache = new Map<string, WordLookupResult>();

export function cacheKey(word: string): string {
  return word;
}

export function getCachedWordInfo(key: string): WordLookupResult | undefined {
  return cache.get(key);
}

export function setCachedWordInfo(key: string, info: WordLookupResult): void {
  cache.set(key, info);
}
