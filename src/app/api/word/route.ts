import { getLlmProvider } from "@/lib/llm";
import { llmErrorResponse } from "@/lib/llm/errors";
import type { WordInfo } from "@/lib/llm/schema";
import {
  findWordByKey,
  insertWord,
  normalizeWordKey,
  touchWord,
  updateWord,
} from "@/lib/wordStore";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const { word, context, force } =
    (body as { word?: unknown; context?: unknown; force?: unknown } | null) ?? {};
  if (typeof word !== "string" || word.trim().length === 0) {
    return Response.json({ error: "word は必須です。" }, { status: 400 });
  }
  const contextText = typeof context === "string" ? context : "";
  const forceRegenerate = force === true;
  const key = normalizeWordKey(word);

  // Cache hit: skip generation entirely unless the caller explicitly asked
  // to regenerate (e.g. the context changed enough that the cached nuance
  // is stale).
  if (!forceRegenerate) {
    const existing = findWordByKey(key);
    if (existing) {
      touchWord(existing.id, new Date().toISOString());
      const info = JSON.parse(existing.info) as WordInfo;
      return Response.json({ ...info, cached: true });
    }
  }

  try {
    const provider = getLlmProvider();
    const info = await provider.wordInfo(word, contextText);

    const existing = forceRegenerate ? findWordByKey(key) : undefined;
    const writeParams = {
      key,
      surface: word,
      context: contextText,
      info,
      provider: provider.name,
      model: provider.model,
    };
    if (existing) {
      updateWord(existing.id, writeParams);
    } else {
      insertWord(writeParams);
    }

    return Response.json({ ...info, cached: false });
  } catch (err) {
    return llmErrorResponse(err);
  }
}
