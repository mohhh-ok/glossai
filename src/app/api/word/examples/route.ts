import { getLlmProvider } from "@/lib/llm";
import { llmErrorResponse } from "@/lib/llm/errors";
import type { WordInfo } from "@/lib/llm/schema";
import { MAX_EXAMPLES_PER_WORD, mergeExamples } from "@/lib/mergeExamples";
import {
  findWordByKey,
  normalizeWordKey,
  updateWordInfoByKey,
} from "@/lib/wordStore";

export const runtime = "nodejs";

/**
 * POST /api/word/examples — "例文をもっと生成": tops a word up to
 * MAX_EXAMPLES_PER_WORD examples, generating only the shortfall and merging
 * it into the persisted WordInfo. Never regenerates the whole entry (that's
 * POST /api/word's `force` path) — only `examples` grows, everything else in
 * the row is untouched.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const { word } = (body as { word?: unknown } | null) ?? {};
  if (typeof word !== "string" || word.trim().length === 0) {
    return Response.json({ error: "word は必須です。" }, { status: 400 });
  }

  const key = normalizeWordKey(word);
  const row = findWordByKey(key);
  if (!row) {
    return Response.json({ error: "該当する単語が見つかりません。" }, { status: 404 });
  }

  const info = JSON.parse(row.info) as WordInfo;
  const shortfall = MAX_EXAMPLES_PER_WORD - info.examples.length;
  if (shortfall <= 0) {
    // すでに上限に達している — 生成せず現在値をそのまま返す。GlossCard/
    // HistoryView 側は examples.length >= MAX_EXAMPLES_PER_WORD でボタン自体
    // を出さないので、通常はここに来るのはボタンが出た後に別タブ等で追加生成
    // が先に走った場合のみ。
    return Response.json({ ...info, examplesAdded: 0 });
  }

  try {
    const provider = getLlmProvider();
    const added = await provider.moreExamples(
      info.word,
      info.examples.map((ex) => ex.en),
      shortfall
    );
    const mergedExamples = mergeExamples(info.examples, added);
    const updatedInfo: WordInfo = { ...info, examples: mergedExamples };

    updateWordInfoByKey(key, updatedInfo);

    return Response.json({
      ...updatedInfo,
      examplesAdded: mergedExamples.length - info.examples.length,
    });
  } catch (err) {
    return llmErrorResponse(err);
  }
}
