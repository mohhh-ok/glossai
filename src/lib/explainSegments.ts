/**
 * Splits an AI 解説 (EXPLAIN) body into alternating segments of "a run of
 * English words" and "everything else" (Japanese text, punctuation, IPA,
 * digits, symbols, ...), so the UI can render English runs as clickable
 * GlossableText without the model needing to mark them up itself.
 *
 * An island is a maximal run of English word tokens
 * ([A-Za-z][A-Za-z'’-]*, so "don't" and "well-known" count as one token)
 * joined only by plain spaces/tabs — a punctuation mark, a non-ASCII
 * character, or a newline all end the run. This is a pure, stateless
 * function: it works identically on a fully-streamed body, a body still
 * being appended to mid-stream, and a body read back unchanged from the
 * `explains` cache table — there is no separate "final" mode and nothing
 * for the model to get wrong, since there's no tag contract to violate.
 */

export interface ExplainSegment {
  type: "en" | "ja";
  text: string;
}

const WORD = "[A-Za-z][A-Za-z'’-]*";
// Only ASCII space/tab join words into the same island — a newline is a
// hard boundary so an island never straddles a line break.
const ISLAND_RE = new RegExp(`${WORD}(?:[ \\t]+${WORD})*`, "g");

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
