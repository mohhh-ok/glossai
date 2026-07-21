import { getLlmProvider } from "@/lib/llm";
import { llmErrorResponse } from "@/lib/llm/errors";

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

  const provider = getLlmProvider();

  try {
    const stream = await provider.explainText(text);
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    return llmErrorResponse(err);
  }
}
