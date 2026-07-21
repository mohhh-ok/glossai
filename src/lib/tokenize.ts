export interface Token {
  type: "word" | "other";
  value: string;
}

/**
 * Splits English text into word tokens (letters plus internal apostrophes/
 * hyphens, e.g. "don't", "well-known") and "other" tokens (whitespace,
 * punctuation, newlines) so the reader view can wrap only words in
 * clickable spans while preserving original spacing exactly.
 */
export function tokenize(text: string): Token[] {
  const regex = /([A-Za-z]+(?:['’-][A-Za-z]+)*)|([^A-Za-z]+)/g;
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      tokens.push({ type: "word", value: match[1] });
    } else if (match[2]) {
      tokens.push({ type: "other", value: match[2] });
    }
  }

  return tokens;
}
