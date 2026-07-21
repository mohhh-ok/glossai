import OpenAI from "openai";
import { OpenAiTtsProvider } from "@/lib/tts/openai";

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

  const provider = new OpenAiTtsProvider();

  try {
    const audio = await provider.synthesize(text);
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) {
      return Response.json(
        { error: "OPENAI_API_KEYが未設定です" },
        { status: 401 }
      );
    }
    if (err instanceof OpenAI.APIError) {
      return Response.json(
        { error: err.message },
        { status: err.status ?? 500 }
      );
    }
    // キー未設定はクライアント構築時にOpenAIError(基底クラス)で投げられる
    if (err instanceof OpenAI.OpenAIError) {
      return Response.json(
        { error: "OPENAI_API_KEYが未設定です。READMEのSetupを参照してください。" },
        { status: 401 }
      );
    }
    console.error(err);
    return Response.json(
      { error: "音声の生成に失敗しました。" },
      { status: 500 }
    );
  }
}
