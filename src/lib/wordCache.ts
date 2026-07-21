import type { WordInfo } from "./llm/schema";

/** /api/word's response shape: the generated/cached info plus whether it was served from the server-side SQLite cache. */
export interface WordLookupResult extends WordInfo {
  cached: boolean;
}

/**
 * Module-level cache keyed by "word::context" so re-clicking the same
 * word/phrase in the same reading session renders instantly instead of
 * re-fetching /api/word. This is separate from (and sits in front of) the
 * server-side SQLite cache in src/lib/wordStore.ts, which persists across
 * sessions/reloads.
 */
const cache = new Map<string, WordLookupResult>();

export function cacheKey(word: string, context: string): string {
  return `${word}::${context}`;
}

export function getCachedWordInfo(key: string): WordLookupResult | undefined {
  return cache.get(key);
}

export function setCachedWordInfo(key: string, info: WordLookupResult): void {
  cache.set(key, info);
}
