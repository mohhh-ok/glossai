import Anthropic from "@anthropic-ai/sdk";

/**
 * Maps an error thrown by the Anthropic SDK to a JSON error Response.
 * Always branches on typed exception classes — never on string matching.
 */
export function anthropicErrorResponse(err: unknown): Response {
  if (err instanceof Anthropic.AuthenticationError) {
    return Response.json(
      { error: "ANTHROPIC_API_KEYが未設定です。README参照。" },
      { status: 401 }
    );
  }
  if (err instanceof Anthropic.APIError) {
    return Response.json(
      { error: err.message },
      { status: err.status ?? 500 }
    );
  }
  // SDKは認証情報の解決失敗(キー未設定)を型なしの素のErrorで投げる
  // (@anthropic-ai/sdk client.ts の "Could not resolve authentication method")。
  // 型判定ができない唯一のケースとして、ここだけメッセージで判定する
  if (
    err instanceof Error &&
    err.message.startsWith("Could not resolve authentication method")
  ) {
    return Response.json(
      { error: "ANTHROPIC_API_KEYが未設定です。READMEのSetupを参照してください。" },
      { status: 401 }
    );
  }
  console.error(err);
  return Response.json(
    { error: "予期しないエラーが発生しました。" },
    { status: 500 }
  );
}
