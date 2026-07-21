import { resolve } from "@/lib/tts/registry";
import { ttsErrorResponse } from "@/lib/tts/errors";

export const runtime = "nodejs";

// Defensive upper bound against pathological requests (e.g. an entire book
// pasted into the reader) — well above any real passage/history entry, which
// are user-pasted English text, not machine-generated bulk content.
const MAX_TEXT_LENGTH = 8000;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const text = (body as { text?: unknown } | null)?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "text は必須です。" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return Response.json({ error: "テキストが長すぎます。" }, { status: 400 });
  }

  try {
    const provider = resolve();
    const { data, contentType } = await provider.synthesize(text);
    return new Response(data, {
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    return ttsErrorResponse(err);
  }
}
