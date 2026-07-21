import { deleteWord, listWordHistory } from "@/lib/wordStore";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listWordHistory());
}

export async function DELETE(req: Request) {
  const idParam = new URL(req.url).searchParams.get("id");
  const id = idParam ? Number(idParam) : NaN;
  if (!Number.isInteger(id)) {
    return Response.json({ error: "id は必須です。" }, { status: 400 });
  }

  const deleted = deleteWord(id);
  if (!deleted) {
    return Response.json({ error: "該当する履歴が見つかりません。" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
