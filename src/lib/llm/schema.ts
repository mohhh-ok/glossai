import { z } from "zod";

/**
 * Structured output schema for a single word/phrase lookup.
 *
 * No length constraints (minLength, array length, etc.) are applied here —
 * Anthropic structured outputs does not support those JSON Schema keywords.
 * Constraints like "exactly 2 examples" are enforced via the prompt instead.
 */
export const WordInfoSchema = z.object({
  word: z.string(),
  ipa: z.string(),
  partOfSpeech: z.string(),
  meaningJa: z.string(),
  nuanceJa: z.string(),
  etymologyJa: z.string(),
  examples: z.array(
    z.object({
      en: z.string(),
      ja: z.string(),
    })
  ),
});

export type WordInfo = z.infer<typeof WordInfoSchema>;
