import OpenAI from "openai";

/** Thrown when GLOSSAI_TTS_PROVIDER=say (or the default) is selected on a non-macOS host. */
export class SayUnsupportedPlatformError extends Error {
  constructor() {
    super(
      "sayプロバイダはmacOS専用です。GLOSSAI_TTS_PROVIDER=openai を設定してください。"
    );
    this.name = "SayUnsupportedPlatformError";
  }
}

/**
 * Thrown when GLOSSAI_TTS_VOICE names a voice `say -v '?'` doesn't list.
 * `say` itself does NOT error on an unknown voice name — confirmed
 * empirically on this machine: `say -v NoSuchVoiceXYZ -o out.m4a
 * --file-format=m4af --data-format=aac` exits 0, writes no stderr, and
 * silently falls back to the system default voice. Left unchecked, a typo
 * in GLOSSAI_TTS_VOICE would produce audio in the wrong voice with no
 * indication anything was wrong, so say.ts validates against the real
 * voice list itself before ever invoking `say` for synthesis.
 */
export class SayVoiceNotFoundError extends Error {
  constructor(public readonly voice: string) {
    super(
      `音声 "${voice}" が見つかりません。\`say -v '?'\` で利用可能な音声を確認してください。`
    );
    this.name = "SayVoiceNotFoundError";
  }
}

/**
 * Thrown when the `say` CLI couldn't be spawned at all, or ran and exited
 * non-zero.
 */
export class SayCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SayCliError";
  }
}

/**
 * Thrown by registry.ts's resolve() when asked for a provider name that
 * isn't registered. Defined here rather than in registry.ts so registry.ts
 * can import it without creating a cycle (mirrors src/lib/llm/errors.ts's
 * UnknownProviderError).
 */
export class UnknownProviderError extends Error {
  constructor(name: string, available: string[]) {
    super(`未知のプロバイダ: "${name}"。利用可能: ${available.join(", ")}`);
    this.name = "UnknownProviderError";
  }
}

/**
 * Maps an error thrown by any TTS provider to a JSON error Response.
 * Mirrors src/lib/llm/errors.ts's llmErrorResponse: always branches on typed
 * exception classes, never on string matching.
 */
export function ttsErrorResponse(err: unknown): Response {
  if (err instanceof UnknownProviderError) {
    return Response.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof SayUnsupportedPlatformError) {
    return Response.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof SayVoiceNotFoundError) {
    return Response.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof SayCliError) {
    return Response.json({ error: err.message }, { status: 500 });
  }
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
