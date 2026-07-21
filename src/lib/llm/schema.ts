import { z } from "zod";

/**
 * Shared element schema for a single example sentence (English + Japanese
 * translation). Referenced by both WordInfoSchema.examples and
 * ExamplesSchema.examples below — kept as the one definition so the two
 * structured-output shapes can never drift apart from each other.
 */
const ExampleSchema = z.object({
  en: z.string(),
  ja: z.string(),
});

export type Example = z.infer<typeof ExampleSchema>;

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
  examples: z.array(ExampleSchema),
});

export type WordInfo = z.infer<typeof WordInfoSchema>;

/**
 * Structured output schema for POST /api/word/examples ("generate N more
 * example sentences for a word already looked up"). A top-level object
 * (rather than a bare `z.array(ExampleSchema)`) because both --json-schema
 * (claude-code.ts) and zodOutputFormat (anthropic.ts) require a JSON object
 * at the top level, same constraint WordInfoSchema is already subject to.
 */
export const ExamplesSchema = z.object({
  examples: z.array(ExampleSchema),
});
