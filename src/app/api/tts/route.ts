import { resolve } from "@/lib/tts/registry";
import { ttsErrorResponse } from "@/lib/tts/errors";

export const runtime = "nodejs";

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
