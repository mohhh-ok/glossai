import { AnthropicLlmProvider } from "@/lib/llm/anthropic";
import { anthropicErrorResponse } from "@/lib/llm/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const { word, context } = (body as { word?: unknown; context?: unknown } | null) ?? {};
  if (typeof word !== "string" || word.trim().length === 0) {
    return Response.json({ error: "word は必須です。" }, { status: 400 });
  }

  const provider = new AnthropicLlmProvider();

  try {
    const info = await provider.wordInfo(
      word,
      typeof context === "string" ? context : ""
    );
    return Response.json(info);
  } catch (err) {
    return anthropicErrorResponse(err);
  }
}
