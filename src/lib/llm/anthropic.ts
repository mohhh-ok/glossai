import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  buildMoreExamplesInput,
  EXPLAIN_SYSTEM_PROMPT,
  MORE_EXAMPLES_SYSTEM_PROMPT,
  WORD_SYSTEM_PROMPT,
} from "./prompts";
import { ExamplesSchema, WordInfoSchema, type Example, type WordInfo } from "./schema";
import type { LlmProvider } from "./types";

const MODEL = process.env.GLOSSAI_MODEL || "claude-opus-4-8";

function client() {
  // Zero-arg constructor: resolves ANTHROPIC_API_KEY or an `ant auth login`
  // profile automatically. Never pass an explicit key here.
  return new Anthropic();
}

export class AnthropicLlmProvider implements LlmProvider {
  readonly name = "anthropic";
  readonly model = MODEL;

  async explainText(text: string): Promise<ReadableStream<Uint8Array>> {
    const encoder = new TextEncoder();

    const anthropicStream = client().messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: EXPLAIN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    // Peek at the first event before handing back a ReadableStream. This
    // forces the underlying HTTP request to fire now, so an auth/API error
    // surfaces here (and can become a proper 401/4xx JSON response) instead
    // of after we've already committed a 200 response with a streaming body.
    const iterator = anthropicStream[Symbol.asyncIterator]();
    const first = await iterator.next();

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          let result = first;
          while (!result.done) {
            const event = result.value;
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
            result = await iterator.next();
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }

  async wordInfo(word: string): Promise<WordInfo> {
    const response = await client().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "low",
        format: zodOutputFormat(WordInfoSchema),
      },
      system: WORD_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `単語/フレーズ: ${word}` }],
    });

    if (!response.parsed_output) {
      throw new Error("単語情報の解析に失敗しました。");
    }

    return response.parsed_output;
  }

  async moreExamples(
    word: string,
    existing: string[],
    count: number
  ): Promise<Example[]> {
    const response = await client().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "low",
        format: zodOutputFormat(ExamplesSchema),
      },
      system: MORE_EXAMPLES_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildMoreExamplesInput(word, existing, count) },
      ],
    });

    if (!response.parsed_output) {
      throw new Error("追加の例文の解析に失敗しました。");
    }

    return response.parsed_output.examples.slice(0, count);
  }
}
