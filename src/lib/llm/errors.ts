import Anthropic from "@anthropic-ai/sdk";

/** Thrown when the `claude` CLI binary cannot be located on PATH. */
export class ClaudeCliNotFoundError extends Error {
  constructor() {
    super(
      "claude CLIが見つかりません。Claude Codeをインストールしてください。"
    );
    this.name = "ClaudeCliNotFoundError";
  }
}

/**
 * Thrown when the `claude` CLI ran but reported failure: either a non-zero
 * exit with no parseable JSON `result` event, or a parseable `result` event
 * with `is_error: true` (invalid model, refusal, auth failure, etc).
 * `message` is the CLI's own human-readable explanation where available.
 */
export class ClaudeCliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly apiErrorStatus: number | null = null
  ) {
    super(message);
    this.name = "ClaudeCliError";
  }
}

/**
 * Thrown by registry.ts's resolve() when asked for a provider name that
 * isn't registered. Defined here rather than in registry.ts so registry.ts
 * can import it without creating a cycle: registry.ts already imports
 * claude-code.ts, which imports ClaudeCliError/ClaudeCliNotFoundError from
 * this file — if this file imported registry.ts back, that would be
 * circular.
 */
export class UnknownProviderError extends Error {
  constructor(name: string, available: string[]) {
    super(`未知のプロバイダ: "${name}"。利用可能: ${available.join(", ")}`);
    this.name = "UnknownProviderError";
  }
}

/**
 * Maps an error thrown by either LLM provider (Anthropic SDK, or the local
 * claude-code CLI provider) to a JSON error Response. Always branches on
 * typed exception classes — never on string matching, except for the one
 * documented Anthropic SDK quirk below.
 */
export function llmErrorResponse(err: unknown): Response {
  if (err instanceof UnknownProviderError) {
    return Response.json({ error: err.message }, { status: 400 });
  }
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
  if (err instanceof ClaudeCliNotFoundError) {
    return Response.json({ error: err.message }, { status: 500 });
  }
  if (err instanceof ClaudeCliError) {
    const status =
      err.apiErrorStatus !== null && err.apiErrorStatus >= 400
        ? err.apiErrorStatus
        : 500;
    return Response.json({ error: err.message }, { status });
  }
  console.error(err);
  return Response.json(
    { error: "予期しないエラーが発生しました。" },
    { status: 500 }
  );
}
