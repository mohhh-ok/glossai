/** Thin provider abstraction for text-to-speech, mirroring src/lib/llm/types.ts. */
export interface TtsProvider {
  /** Synthesizes `text` and returns raw audio bytes (audio/mpeg). */
  synthesize(text: string): Promise<ArrayBuffer>;
}
