import type { WordInfo } from "./llm/schema";

/**
 * Module-level cache keyed by "word::context" so re-clicking the same
 * word/phrase in the same reading session renders instantly instead of
 * re-fetching /api/word.
 */
const cache = new Map<string, WordInfo>();

export function cacheKey(word: string, context: string): string {
  return `${word}::${context}`;
}

export function getCachedWordInfo(key: string): WordInfo | undefined {
  return cache.get(key);
}

export function setCachedWordInfo(key: string, info: WordInfo): void {
  cache.set(key, info);
}
