/**
 * Splits an AI 解説 (EXPLAIN) body into alternating segments of "a run of
 * English text" and "everything else" (Japanese text, IPA, symbols, ...),
 * so the UI can render English runs as clickable GlossableText without the
 * model needing to mark them up itself.
 *
 * An island is a maximal run of English word tokens
 * ([A-Za-z0-9][A-Za-z0-9'’-]*, so "don't", "well-known", "3D" count as one
 * token) joined by spaces/tabs **or by common intra-sentence punctuation**
 * ((), &, /, commas, colons, straight and curly quotes, periods, dashes,
 * ...). A quoted or parenthesized stretch inside an English sentence —
 * `call themselves “labs” when ...`, `(looksmaxxing) "researchers" &
 * engineers` — therefore stays ONE island, so its speaker button covers the
 * whole passage instead of fragmenting it. Punctuation joins only when more
 * English follows; sentence-final closers (.!?"”’)) are absorbed into the
 * island so TTS reads a natural full stop. Japanese (any non-ASCII letter
 * outside the separator set) and newlines are the only hard boundaries.
 *
 * This is a pure, stateless function: it works identically on a
 * fully-streamed body, a body still being appended to mid-stream, and a
 * body read back unchanged from the `explains` cache table.
 * Invariant: concatenating the segments in order reproduces `text` exactly.
 */

export interface ExplainSegment {
  type: "en" | "ja";
  text: string;
}

const WORD = "[A-Za-z0-9][A-Za-z0-9'’-]*";
// Separators that may join two English words into the same island. A newline
// is deliberately excluded — an island never straddles a line break.
const SEP = `[ \\t()&/,:;"“”'’.!?%–—-]`;
// Sentence-final punctuation absorbed at the end of an island (no word needs
// to follow these).
const CLOSER = `[.!?"”’)]`;
const ISLAND_RE = new RegExp(
  `${WORD}(?:${SEP}+${WORD})*(?:${CLOSER}+)?`,
  "g"
);

export function splitExplainSegments(text: string): ExplainSegment[] {
  const segments: ExplainSegment[] = [];
  let lastIndex = 0;

  ISLAND_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ISLAND_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "ja", text: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "en", text: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "ja", text: text.slice(lastIndex) });
  }

  return segments;
}
