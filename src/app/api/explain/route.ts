import { getLlmProvider } from "@/lib/llm";
import { llmErrorResponse } from "@/lib/llm/errors";
import { findExplainByHash, hashExplainText, insertExplain } from "@/lib/explainStore";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const text = (requestBody as { text?: unknown } | null)?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "text は必須です。" }, { status: 400 });
  }

  const hash = hashExplainText(text);
  const cached = findExplainByHash(hash);
  if (cached) {
    return new Response(streamOf(cached.body), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const provider = getLlmProvider();
    const upstream = await provider.explainText(text);
    const stream = upstream.pipeThrough(bufferAndPersist(text, hash, provider));
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    return llmErrorResponse(err);
  }
}

/** A single-chunk stream for an already-cached body (no need to re-stream incrementally). */
function streamOf(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

/**
 * Passes chunks through unchanged while buffering the full text on the side.
 * Only persists to SQLite in `flush()`, which TransformStream calls solely
 * on a normal, fully-successful completion of the writable side — never on
 * an upstream error (the readable side errors instead, propagating out
 * without ever reaching flush) or on a client-initiated abort (which
 * cancels the pipe instead of closing it). That gives "don't save on
 * error/abort" for free, without any explicit try/catch bookkeeping here.
 */
function bufferAndPersist(
  text: string,
  hash: string,
  provider: { name: string; model: string }
): TransformStream<Uint8Array, Uint8Array> {
  let buffered = "";
  const decoder = new TextDecoder();
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffered += decoder.decode(chunk, { stream: true });
      controller.enqueue(chunk);
    },
    flush() {
      buffered += decoder.decode();
      insertExplain({
        hash,
        text,
        body: buffered,
        provider: provider.name,
        model: provider.model,
      });
    },
  });
}
