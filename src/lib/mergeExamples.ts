import type { Example } from "./llm/schema";

/**
 * Hard cap on examples per word, everywhere: the initial generation's 2, and
 * the "例文をもっと生成" ceiling both derive from this single constant —
 * see WORD_SYSTEM_PROMPT (2) and POST /api/word/examples's `target` (this).
 */
export const MAX_EXAMPLES_PER_WORD = 10;

/**
 * Merges freshly generated `added` examples into `existing`, keeping
 * `existing` first and in its original order (dictionary-style: never
 * reshuffle what the user has already seen), then appending `added` in
 * order while dropping any whose `en` exactly matches one already present —
 * either from `existing` or from an earlier entry in `added` itself. The
 * result is capped at MAX_EXAMPLES_PER_WORD as defense in depth against a
 * provider that returned more than the requested count.
 *
 * Pure and side-effect free by design so it's unit-testable without a DB or
 * LLM call — POST /api/word/examples is the only caller, wiring this to the
 * `words` row's persisted info.examples.
 */
export function mergeExamples(existing: Example[], added: Example[]): Example[] {
  const seen = new Set(existing.map((ex) => ex.en));
  const merged = [...existing];
  for (const ex of added) {
    if (seen.has(ex.en)) continue;
    seen.add(ex.en);
    merged.push(ex);
  }
  return merged.slice(0, MAX_EXAMPLES_PER_WORD);
}
