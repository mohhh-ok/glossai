import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { z } from "zod";
import { EXPLAIN_SYSTEM_PROMPT, WORD_SYSTEM_PROMPT } from "./prompts";
import { WordInfoSchema, type WordInfo } from "./schema";
import type { LlmProvider } from "./types";
import { ClaudeCliError, ClaudeCliNotFoundError } from "./errors";

// Default model for this provider is "sonnet" (not "opus" like the
// AnthropicProvider default) — deliberately conservative on a subscription's
// shared rate limits and per-call latency, per the task spec. GLOSSAI_MODEL
// overrides it; the CLI accepts both aliases (sonnet/opus/haiku/fable) and
// full model IDs via --model, confirmed via `claude --help`.
const MODEL = process.env.GLOSSAI_MODEL || "sonnet";

// Kill a hung `claude` child after this long. There is no per-request
// timeout flag on the CLI itself, so this is enforced client-side.
const PROCESS_TIMEOUT_MS = 120_000;

/**
 * JSON Schema produced by zod's `z.toJSONSchema()` for --json-schema.
 * The CLI's schema validator rejects a top-level `$schema` key (empirically:
 * `Error: --json-schema is not a valid JSON Schema: no schema with key or
 * ref "https://json-schema.org/draft/2020-12/schema"` — it tries to resolve
 * it as a $ref against a schema registry it doesn't have loaded), so it must
 * be stripped before passing the schema on the command line.
 */
function wordInfoJsonSchema(): string {
  const schema = z.toJSONSchema(WordInfoSchema) as Record<string, unknown>;
  delete schema.$schema;
  return JSON.stringify(schema);
}

/**
 * Flags shared by every invocation. glossai only needs single-shot text
 * generation, so tools/skills/MCP/session-persistence are all disabled:
 *
 * - `--tools ""`: no tool access is needed, and — since this CLI build
 *   (2.1.216) has no `--max-turns` flag — this is also what caps a plain
 *   (non-structured-output) call to a single model turn: with zero tools
 *   available, there is nothing for the model to call, so it can't loop.
 * - `--system-prompt <text>`: *replaces* the default Claude Code system
 *   prompt (cwd/git-status/memory-path boilerplate), rather than appending
 *   to it. Confirmed empirically: a trivial "Reply with exactly: OK" probe
 *   cost ~18k prompt tokens under the default system prompt on this
 *   machine (it also picked up this user's ~/.claude `"model"` override,
 *   see --setting-sources below) versus ~190 tokens with an explicit
 *   `--system-prompt` + `--setting-sources ""`.
 * - `--disable-slash-commands` / `--strict-mcp-config` / `--setting-sources
 *   ""`: skip skill loading, ignore any ambient MCP server config, and skip
 *   loading the invoking user's project/user/local settings.json. This
 *   matters because a user's own settings.json can silently override the
 *   model, plugins, and default permission mode for every `claude -p` call
 *   made on their machine — confirmed on this machine, where user settings
 *   set `"model": "claude-fable-5[1m]"` globally.
 * - `--no-session-persistence`: don't write a resumable session to disk;
 *   glossai has no use for `claude --resume`.
 *
 * Deliberately NOT using `--bare`: per `claude --help`, `--bare` restricts
 * auth to `ANTHROPIC_API_KEY`/`apiKeyHelper` and never reads OAuth/keychain
 * credentials — that would break the whole point of this provider, which is
 * running under the user's Claude subscription login instead of an API key.
 */
function baseArgs(systemPrompt: string, effort: "low" | "medium"): string[] {
  return [
    "-p",
    "--model",
    MODEL,
    "--tools",
    "",
    "--effort",
    effort,
    "--system-prompt",
    systemPrompt,
    "--disable-slash-commands",
    "--strict-mcp-config",
    "--setting-sources",
    "",
    "--no-session-persistence",
  ];
}

/**
 * Spawns `claude` with the given args and writes `stdinText` as the prompt
 * on stdin — never as a CLI argument, so there is no shell-injection surface
 * regardless of what the user pastes. Confirmed empirically: `claude -p`
 * (no positional prompt argument) reads the prompt from stdin when stdin is
 * piped, for both `--output-format json` and `--output-format stream-json`.
 */
function spawnClaude(args: string[], stdinText: string): ChildProcessWithoutNullStreams {
  const child = spawn("claude", args, {
    stdio: ["pipe", "pipe", "pipe"],
    timeout: PROCESS_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });
  child.stdin.write(stdinText, "utf8");
  child.stdin.end();
  return child;
}

/** Shape of the `result` event/line common to both `json` and `stream-json` output. */
export interface ClaudeResultEvent {
  type: "result";
  subtype: string;
  is_error: boolean;
  api_error_status: number | null;
  result: string | null;
  structured_output?: unknown;
  /** Populated on failures like error_max_structured_output_retries; `result` is null then. */
  errors?: unknown[];
}

/** The CLI gave up after N structured-output validation failures (--json-schema). */
export const SUBTYPE_STRUCTURED_OUTPUT_FAILED =
  "error_max_structured_output_retries";

function isResultEvent(obj: unknown): obj is ClaudeResultEvent {
  return (
    typeof obj === "object" &&
    obj !== null &&
    (obj as { type?: unknown }).type === "result"
  );
}

/** Builds a ClaudeCliError from a parsed `result` event that reported failure. */
export function errorFromResultEvent(
  result: ClaudeResultEvent,
  exitCode: number | null
): ClaudeCliError {
  // 失敗時は `result` がnullで、実因が `errors` 配列にだけ入っていることがある
  // (実測: error_max_structured_output_retries)。汎用文言に落とす前に必ず拾う。
  const errorsText = Array.isArray(result.errors)
    ? result.errors.filter((e) => typeof e === "string").join(" / ")
    : "";
  const rawMessage =
    typeof result.result === "string" && result.result.trim().length > 0
      ? result.result
      : errorsText.length > 0
        ? `claude CLIがエラーを返しました(${result.subtype}): ${errorsText}`
        : `claude CLIが終了コード${exitCode}で失敗しました。`;
  // Not empirically confirmed against a real logged-out CLI (that would
  // require signing this machine's own Claude Code session out mid-task).
  // This is a best-effort heuristic layered on top of the raw CLI message,
  // which is always surfaced as a fallback either way.
  const looksLikeAuthFailure =
    result.api_error_status === 401 ||
    /not logged in|please run ["`]?claude auth login|authentication/i.test(
      rawMessage
    );
  const message = looksLikeAuthFailure
    ? "Claude Codeにログインしていません。ターミナルで `claude auth login` を実行してください。"
    : rawMessage;
  return new ClaudeCliError(
    message,
    exitCode,
    result.api_error_status,
    result.subtype
  );
}

/** Runs `claude` to completion and returns its parsed `result` event (used by wordInfo). */
function runClaudeJson(
  args: string[],
  stdinText: string
): Promise<ClaudeResultEvent> {
  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawnClaude(args, stdinText);
    } catch (err) {
      reject(err);
      return;
    }

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(new ClaudeCliNotFoundError());
      } else {
        reject(err);
      }
    });

    child.on("close", (code) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        reject(
          new ClaudeCliError(
            stderr.trim() || `claude CLIが終了コード${code}で失敗しました。`,
            code
          )
        );
        return;
      }
      if (!isResultEvent(parsed)) {
        reject(
          new ClaudeCliError(
            "claude CLIから予期しない形式の出力を受け取りました。",
            code
          )
        );
        return;
      }
      if (parsed.is_error || parsed.subtype !== "success") {
        reject(errorFromResultEvent(parsed, code));
        return;
      }
      resolve(parsed);
    });
  });
}

export class ClaudeCodeProvider implements LlmProvider {
  readonly name = "claude-code";
  readonly model = MODEL;

  /**
   * Streams the explanation via `--output-format stream-json
   * --include-partial-messages --verbose`. Confirmed empirically that this
   * build of the CLI *does* emit incremental `content_block_delta` /
   * `text_delta` events (JSONL lines shaped like
   * `{"type":"stream_event","event":{...Messages-API SSE event...}}`), so
   * partial streaming is the primary path, not a fallback. `--verbose` is
   * required — omitting it errors with "When using --print,
   * --output-format=stream-json requires --verbose" (confirmed empirically).
   * As a defensive fallback (a line that fails to parse, or a build of the
   * CLI that stops emitting partials), if the process closes successfully
   * but not a single delta was ever enqueued, the full text from the
   * terminal `result` event is enqueued at once.
   */
  async explainText(text: string): Promise<ReadableStream<Uint8Array>> {
    const encoder = new TextEncoder();
    const args = [
      ...baseArgs(EXPLAIN_SYSTEM_PROMPT, "medium"),
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--verbose",
    ];

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawnClaude(args, text);
    } catch (err) {
      throw err;
    }

    return new ReadableStream<Uint8Array>({
      start(controller) {
        let lineBuffer = "";
        let sawAnyDelta = false;
        let fallbackText: string | null = null;
        let resultError: ClaudeCliError | null = null;
        let stderrBuf = "";

        function handleLine(line: string) {
          const trimmed = line.trim();
          if (!trimmed) return;
          let obj: unknown;
          try {
            obj = JSON.parse(trimmed);
          } catch {
            // Ignore a line that doesn't parse as JSON — the JSONL stream
            // should never emit one, but this must not crash the response.
            return;
          }
          if (
            typeof obj === "object" &&
            obj !== null &&
            (obj as { type?: unknown }).type === "stream_event"
          ) {
            const event = (obj as { event?: unknown }).event;
            if (
              typeof event === "object" &&
              event !== null &&
              (event as { type?: unknown }).type === "content_block_delta"
            ) {
              const delta = (event as { delta?: unknown }).delta;
              if (
                typeof delta === "object" &&
                delta !== null &&
                (delta as { type?: unknown }).type === "text_delta" &&
                typeof (delta as { text?: unknown }).text === "string"
              ) {
                sawAnyDelta = true;
                controller.enqueue(
                  encoder.encode((delta as { text: string }).text)
                );
              }
            }
            return;
          }
          if (isResultEvent(obj)) {
            if (obj.is_error || obj.subtype !== "success") {
              resultError = errorFromResultEvent(obj, null);
            } else if (!sawAnyDelta && typeof obj.result === "string") {
              fallbackText = obj.result;
            }
          }
        }

        child.stdout.on("data", (chunk: Buffer) => {
          lineBuffer += chunk.toString("utf8");
          let newlineIndex: number;
          while ((newlineIndex = lineBuffer.indexOf("\n")) >= 0) {
            const line = lineBuffer.slice(0, newlineIndex);
            lineBuffer = lineBuffer.slice(newlineIndex + 1);
            handleLine(line);
          }
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderrBuf += chunk.toString("utf8");
        });

        child.on("error", (err: NodeJS.ErrnoException) => {
          controller.error(
            err.code === "ENOENT" ? new ClaudeCliNotFoundError() : err
          );
        });

        child.on("close", (code) => {
          if (lineBuffer.trim()) handleLine(lineBuffer);
          if (resultError) {
            controller.error(resultError);
            return;
          }
          if (!sawAnyDelta && fallbackText !== null) {
            controller.enqueue(encoder.encode(fallbackText));
          } else if (!sawAnyDelta && code !== 0) {
            controller.error(
              new ClaudeCliError(
                stderrBuf.trim() || `claude CLIが終了コード${code}で失敗しました。`,
                code
              )
            );
            return;
          }
          controller.close();
        });
      },
    });
  }

  /**
   * Uses `--json-schema` (validated live against this CLI build — see
   * SKILL research) to force the model to emit output matching
   * WordInfoSchema's shape, then re-validates with zod before returning
   * (defense in depth: the CLI's own schema validation is not a substitute
   * for the app's own type guarantees). Retries once on a parse/validation
   * failure only — a hard CLI/API-level failure (auth, invalid model, etc)
   * propagates immediately without retrying.
   */
  async wordInfo(word: string): Promise<WordInfo> {
    const args = [
      ...baseArgs(WORD_SYSTEM_PROMPT, "low"),
      "--json-schema",
      wordInfoJsonSchema(),
      "--output-format",
      "json",
    ];
    const stdinText = `単語/フレーズ: ${word}`;

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      let resultEvent: ClaudeResultEvent;
      try {
        resultEvent = await runClaudeJson(args, stdinText);
      } catch (err) {
        // モデルがスキーマ通りの構造化出力を5回連続で出せずCLIが諦めるケースが
        // 確率的に起きる(実測: プレースホルダ "$PARAMETER_NAME" をフィールド名に
        // 書いてしまう事故)。この失敗に限り、--json-schemaを使わない素のJSON生成
        // にフォールバックする。それ以外のCLI/APIエラーは即時伝播。
        if (
          err instanceof ClaudeCliError &&
          err.subtype === SUBTYPE_STRUCTURED_OUTPUT_FAILED
        ) {
          return this.wordInfoWithoutSchema(stdinText);
        }
        throw err;
      }
      const candidate =
        resultEvent.structured_output ?? tryParseJson(resultEvent.result);
      const parsed = WordInfoSchema.safeParse(candidate);
      if (parsed.success) {
        return parsed.data;
      }
      lastError = parsed.error;
    }
    throw new ClaudeCliError(
      `単語情報の解析に失敗しました: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
      null
    );
  }

  /**
   * フォールバック経路: --json-schemaを使わず、プロンプト指示で素のJSONを
   * 出力させてzodで検証する。構造化出力のリトライ上限に達したときのみ呼ぶ。
   */
  private async wordInfoWithoutSchema(stdinText: string): Promise<WordInfo> {
    const systemPrompt = `${WORD_SYSTEM_PROMPT}

回答は上記フィールドを持つ単一のJSONオブジェクトのみを出力すること。コードフェンスや説明文をJSONの前後に付けないこと。`;
    const args = [...baseArgs(systemPrompt, "low"), "--output-format", "json"];
    const resultEvent = await runClaudeJson(args, stdinText);
    const parsed = WordInfoSchema.safeParse(tryParseJson(resultEvent.result));
    if (parsed.success) {
      return parsed.data;
    }
    throw new ClaudeCliError(
      `単語情報の解析に失敗しました(フォールバック経路): ${parsed.error.message}`,
      null
    );
  }
}

function tryParseJson(text: string | null): unknown {
  if (typeof text !== "string") return undefined;
  // 指示していてもモデルがコードフェンスで包むことがあるため防御的に剥がす
  const unfenced = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "");
  try {
    return JSON.parse(unfenced);
  } catch {
    return undefined;
  }
}
