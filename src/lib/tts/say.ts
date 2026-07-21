import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SayCliError, SayUnsupportedPlatformError, SayVoiceNotFoundError } from "./errors";
import type { TtsProvider, TtsResult } from "./types";

// Confirmed empirically on this machine (macOS, /usr/bin/say) via
// `say -v '?'`: Samantha (en_US) is installed and is the most natural
// general-American voice on a stock install, as opposed to novelty voices
// (Albert, Zarvox, Bad News, ...) or dated formant synths (Fred). Used
// unless GLOSSAI_TTS_VOICE overrides it.
const DEFAULT_VOICE = "Samantha";

/**
 * `say -v '?'` lists every installed voice, one per line, formatted as
 * `<name><padding><locale> # <sample text>`. Padding width is not fixed —
 * long names with wide glosses (e.g. `Eddy (英語（イギリス）)`) collapse to a
 * single space before the locale column — and locale is usually `xx_XX` but
 * at least one voice (Majed, Arabic) uses `xx_NNN`. This regex was verified
 * against the full multi-language voice list on this machine (185 lines
 * across ~50 locales): every line matched, including all of the above edge
 * cases.
 */
const VOICE_LINE = /^(.+?)\s+[a-zA-Z]{2,3}_[a-zA-Z0-9]+\s+#/;

/**
 * Spawns `say` with `args`, writing `stdinText` on stdin (never as a CLI
 * argument — no shell is involved, so there's no injection surface). stdin
 * is always closed immediately after writing (or immediately, if
 * `stdinText` is null) since `say -v '?'` doesn't need input and, per `say
 * --help`'s synopsis (`-f file | string`), only reads stdin when neither a
 * message argument nor `-f` is given — confirmed not to hang even with
 * stdin closed on `/dev/null` up front.
 */
function runSay(
  args: string[],
  stdinText: string | null
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("say", args, { stdio: ["pipe", "pipe", "pipe"] });
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
        reject(
          new SayCliError(
            "sayコマンドが見つかりません。macOS標準のTTSが利用できません。"
          )
        );
      } else {
        reject(err);
      }
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new SayCliError(
            stderr.trim() || `sayコマンドが終了コード${code}で失敗しました。`
          )
        );
        return;
      }
      resolve({ stdout, stderr });
    });

    if (stdinText !== null) {
      child.stdin.write(stdinText, "utf8");
    }
    child.stdin.end();
  });
}

// Memoized for the life of the process — the installed voice list doesn't
// change at runtime, and re-running `say -v '?'` (~150-300ms observed) on
// every synthesize() call would be wasted work.
let cachedVoiceNames: Promise<Set<string>> | null = null;

function listVoiceNames(): Promise<Set<string>> {
  if (!cachedVoiceNames) {
    cachedVoiceNames = runSay(["-v", "?"], null).then(({ stdout }) => {
      const names = new Set<string>();
      for (const line of stdout.split("\n")) {
        const match = line.match(VOICE_LINE);
        if (match) names.add(match[1]);
      }
      return names;
    });
  }
  return cachedVoiceNames;
}

async function resolveVoice(): Promise<string> {
  const requested = process.env.GLOSSAI_TTS_VOICE?.trim();
  const voice = requested || DEFAULT_VOICE;
  const names = await listVoiceNames();
  if (!names.has(voice)) {
    throw new SayVoiceNotFoundError(voice);
  }
  return voice;
}

export class SayTtsProvider implements TtsProvider {
  async synthesize(text: string): Promise<TtsResult> {
    if (process.platform !== "darwin") {
      throw new SayUnsupportedPlatformError();
    }

    const voice = await resolveVoice();
    const outPath = join(tmpdir(), `glossai-tts-${randomUUID()}.m4a`);

    try {
      // Direct AAC-in-M4A output confirmed on this machine — no AIFF ->
      // afconvert second step needed: `say -o out.m4a --file-format=m4af
      // --data-format=aac` produces a file `afinfo` reports directly as
      // `File type ID: m4af` / `Data format: ... aac`, playable as-is.
      await runSay(
        ["-v", voice, "-o", outPath, "--file-format=m4af", "--data-format=aac"],
        text
      );
      const buffer = await readFile(outPath);
      const data = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer;
      return { data, contentType: "audio/mp4" };
    } finally {
      await unlink(outPath).catch(() => {});
    }
  }
}
