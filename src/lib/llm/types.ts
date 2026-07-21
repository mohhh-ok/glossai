import type { Example, WordInfo } from "./schema";

/**
 * Thin provider abstraction so the LLM backend can be swapped without
 * touching route handlers or UI. Keep this interface minimal — it should
 * only ever grow the two operations glossai actually needs.
 */
export interface LlmProvider {
  /**
   * Registry name this provider is resolved under (e.g. "anthropic",
   * "claude-code"). Recorded alongside cached DB rows for provenance —
   * callers should read this rather than re-deriving it from env vars, so
   * the provider/model resolution logic has exactly one source of truth.
   */
  readonly name: string;

  /** Model identifier actually in effect (after GLOSSAI_MODEL / per-provider default). */
  readonly model: string;

  /**
   * Streams a Japanese reading-comprehension explanation of `text`.
   * Returns a stream of raw UTF-8 text chunks (plain text, not JSON/SSE).
   */
  explainText(text: string): Promise<ReadableStream<Uint8Array>>;

  /**
   * Looks up a word or short phrase. Context-free by design: WordInfo rows
   * are cached and shared across every sentence a word ever appears in (see
   * wordStore.ts's key = normalizeWordKey(surface)), so a generation that
   * leaned on the originating sentence would leak that sentence's specifics
   * into an explanation later served for an unrelated one.
   */
  wordInfo(word: string): Promise<WordInfo>;

  /**
   * Generates up to `count` additional example sentences for a word/phrase
   * already looked up (POST /api/word/examples's "例文をもっと生成"). Avoids
   * repeating `existing` (the `en` side of examples already shown to the
   * user) so a repeated click keeps surfacing new scenes/collocations
   * instead of the same handful of sentences. Context-free, same as
   * wordInfo() above — see its doc comment.
   *
   * The returned array is capped at `count` by the implementation (a
   * provider that ignores the requested count and returns extras must not
   * leak them to the caller) but may be shorter if generation/validation
   * fails partway — callers should not assume exactly `count` come back.
   */
  moreExamples(word: string, existing: string[], count: number): Promise<Example[]>;
}
