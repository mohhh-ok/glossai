import { restoreExplain, type ExplainRestoreParams } from "@/lib/explainStore";
import { restoreWord, type WordRestoreParams } from "@/lib/wordStore";

export const runtime = "nodejs";

/**
 * Restores an /history row a client optimistically deleted and then asked
 * to undo. The request carries exactly the row data the client held (i.e.
 * whatever GET /api/history's response shape includes for that type) — see
 * HistoryView's WordEntry/ExplainEntry. Extra fields the client sends (e.g.
 * `id`, `key`) are accepted but ignored: both stores re-derive their own
 * identity (key / text_hash) rather than trusting a client-supplied value.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const { type, entry } =
    (body as { type?: unknown; entry?: unknown } | null) ?? {};

  if (type === "word") {
    if (!isWordEntry(entry)) {
      return Response.json({ error: "entry の形式が不正です。" }, { status: 400 });
    }
    restoreWord(entry);
    return Response.json({ ok: true });
  }

  if (type === "explain") {
    if (!isExplainEntry(entry)) {
      return Response.json({ error: "entry の形式が不正です。" }, { status: 400 });
    }
    restoreExplain(entry);
    return Response.json({ ok: true });
  }

  return Response.json(
    { error: "type は word か explain のいずれかです。" },
    { status: 400 }
  );
}

function isWordEntry(v: unknown): v is WordRestoreParams {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.surface === "string" &&
    e.info !== undefined &&
    e.info !== null &&
    typeof e.lookup_count === "number" &&
    typeof e.created_at === "string" &&
    typeof e.last_seen_at === "string"
  );
}

function isExplainEntry(v: unknown): v is ExplainRestoreParams {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.text === "string" &&
    typeof e.body === "string" &&
    (e.provider === null || typeof e.provider === "string") &&
    (e.model === null || typeof e.model === "string") &&
    typeof e.created_at === "string"
  );
}
