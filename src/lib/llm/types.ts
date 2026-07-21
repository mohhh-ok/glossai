import type { WordInfo } from "./schema";

/**
 * Thin provider abstraction so the LLM backend can be swapped without
 * touching route handlers or UI. Keep this interface minimal — it should
 * only ever grow the two operations glossai actually needs.
 */
export interface LlmProvider {
  /**
   * Streams a Japanese reading-comprehension explanation of `text`.
   * Returns a stream of raw UTF-8 text chunks (plain text, not JSON/SSE).
   */
  explainText(text: string): Promise<ReadableStream<Uint8Array>>;

  /** Looks up a word or short phrase within its surrounding context. */
  wordInfo(word: string, context: string): Promise<WordInfo>;
}
