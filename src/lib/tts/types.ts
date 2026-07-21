/**
 * Result of a synthesize() call: raw audio bytes plus the MIME type they're
 * encoded in. Providers produce different container/codec combinations (the
 * `say` provider writes AAC-in-M4A, OpenAI's TTS API returns MP3), so the
 * Content-Type has to travel with the bytes rather than being hardcoded by
 * the route handler.
 */
export interface TtsResult {
  data: ArrayBuffer;
  contentType: string;
}

/** Thin provider abstraction for text-to-speech, mirroring src/lib/llm/types.ts. */
export interface TtsProvider {
  /** Synthesizes `text` and returns the raw audio bytes and their Content-Type. */
  synthesize(text: string): Promise<TtsResult>;
}
