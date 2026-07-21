import { deleteExplain, listExplains } from "@/lib/explainStore";
import { deleteWord, listWordHistory } from "@/lib/wordStore";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    words: listWordHistory(),
    explains: listExplains(),
  });
}

type HistoryType = "word" | "explain";

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const idParam = url.searchParams.get("id");
  const typeParam = url.searchParams.get("type") ?? "word";
  const id = idParam ? Number(idParam) : NaN;

  if (!Number.isInteger(id)) {
    return Response.json({ error: "id は必須です。" }, { status: 400 });
  }
  if (typeParam !== "word" && typeParam !== "explain") {
    return Response.json(
      { error: "type は word か explain のいずれかです。" },
      { status: 400 }
    );
  }

  const type = typeParam as HistoryType;
  const deleted = type === "explain" ? deleteExplain(id) : deleteWord(id);
  if (!deleted) {
    return Response.json({ error: "該当する履歴が見つかりません。" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
