# glossai

An open-source English reader that explains what you're reading — in Japanese.

Paste any English text and glossai reads it back to you: click a word or drag-select a short phrase to get its meaning, IPA pronunciation, nuance, etymology, and example sentences, all explained in Japanese with audio playback. Ask for a full paragraph-by-paragraph reading breakdown with one click.

glossai is BYOK (bring your own key) and self-hosted — it never proxies your keys anywhere but the model providers themselves.

![screenshot placeholder](./docs/screenshot.png)

## Features

- **Paste-and-read** — drop in any English text, no accounts, no setup beyond API keys.
- **Word & phrase lookup** — click any word, or drag-select 2–6 words, to open a popover with meaning, part of speech, IPA, nuance, and etymology.
- **Example sentences with audio** — every word comes with two contextual example sentences, each with its own speaker button.
- **AI reading breakdown** — a streamed, sentence-by-sentence explanation of the whole passage, plus key expressions worth learning.
- **Persistent cache & history** — word lookups and reading breakdowns are cached in a local SQLite database, so looking up the same word or passage again returns instantly instead of re-generating. Every word you've looked up is browsable on the `/history` page — see [Data storage](#data-storage).
- **BYOK, self-hosted** — bring your own Anthropic and OpenAI API keys; nothing is stored server-side beyond the request lifecycle.
- **Plugin providers** — the LLM and TTS backends sit behind thin interfaces with a small registry (`src/lib/llm`, `src/lib/tts`), so swapping or adding a provider doesn't touch route handlers or UI. Audio works out of the box via macOS's built-in `say` — no API key needed for TTS.

## Quick Start

```bash
pnpm i
cp .env.example .env.local
# edit .env.local and add your API keys
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

All configuration is via environment variables (`.env.local`):

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes, if `GLOSSAI_LLM_PROVIDER=anthropic` | — | Used for reading explanations and word/phrase lookups. |
| `OPENAI_API_KEY` | Yes, if `GLOSSAI_TTS_PROVIDER=openai` | — | Used for text-to-speech playback via the OpenAI API. |
| `GLOSSAI_LLM_PROVIDER` | No | `anthropic` | `anthropic` or `claude-code` — see [Use your Claude subscription](#use-your-claude-subscription-claude-code-backend) below. |
| `GLOSSAI_MODEL` | No | `claude-opus-4-8` (`anthropic`) / `sonnet` (`claude-code`) | Model used for both the explain and word-lookup endpoints. |
| `GLOSSAI_TTS_PROVIDER` | No | `say` | `say` (macOS's built-in TTS, no API key) or `openai` (`gpt-4o-mini-tts`, needs `OPENAI_API_KEY`). |
| `GLOSSAI_TTS_VOICE` | No | `Samantha` (`say`) / `alloy` (`openai`) | Voice name for whichever TTS provider is active. For `say`, must be a name `say -v '?'` lists. |
| `GLOSSAI_DB` | No | `data/glossai.db` | Path to the SQLite cache/history database. See [Data storage](#data-storage). |

## Providers (plugin architecture)

The LLM and TTS backends are both pluggable providers behind a small registry — `src/lib/llm/registry.ts` and `src/lib/tts/registry.ts`. Adding a new backend is 3 steps:

1. **Implement the interface** — `LlmProvider` (`src/lib/llm/types.ts`) or `TtsProvider` (`src/lib/tts/types.ts`) — in a new file alongside the existing providers.
2. **Register it** — add one line to the `providers` map in the corresponding `registry.ts`.
3. **Switch to it** — set `GLOSSAI_LLM_PROVIDER` or `GLOSSAI_TTS_PROVIDER` to its registered name.

No other file needs to change; route handlers only ever see the interface. An unrecognized provider name fails fast with the list of registered names, rather than silently falling back to the default.

Built-in providers:

| Registry | Name | File | Notes |
| --- | --- | --- | --- |
| LLM | `anthropic` (default) | `src/lib/llm/anthropic.ts` | Official Anthropic SDK, billed to `ANTHROPIC_API_KEY`. |
| LLM | `claude-code` | `src/lib/llm/claude-code.ts` | Local `claude` CLI, subscription login instead of an API key. |
| TTS | `say` (default) | `src/lib/tts/say.ts` | macOS's built-in `say`, no API key, macOS only. |
| TTS | `openai` | `src/lib/tts/openai.ts` | `gpt-4o-mini-tts` via the OpenAI API. |

## Use your Claude subscription (Claude Code backend)

If you have a Claude subscription (Pro/Max) and don't want to pay for API credits separately, set:

```bash
GLOSSAI_LLM_PROVIDER=claude-code
```

This routes the explain and word-lookup endpoints through your local [Claude Code](https://claude.com/product/claude-code) CLI (`claude -p`, headless/print mode) instead of the Anthropic API. `ANTHROPIC_API_KEY` is not needed for this backend. This setting is independent of TTS — see `GLOSSAI_TTS_PROVIDER` above.

Requirements:

- The `claude` CLI must be installed and on `PATH`.
- You must already be logged in (`claude auth login` — subscription OAuth, not an API key).

Notes:

- This is a personal, local-use setup — each request spawns a `claude` subprocess, so latency is higher than calling the API directly (roughly a couple of seconds of fixed overhead per request on top of generation time).
- No tools, MCP servers, or session persistence are used; every request is a stateless, single-turn call scoped to just the prompt glossai sends.
- `GLOSSAI_MODEL` accepts the same values as `claude --model` (aliases like `sonnet`/`opus`/`haiku`, or a full model ID); defaults to `sonnet` for this backend specifically, to keep per-request latency and shared subscription rate limits in check.

## Data storage

Every word/phrase lookup and every reading breakdown is cached server-side in a SQLite database, so repeat lookups of the same word (or re-reading a passage you already asked for a breakdown of) skip generation entirely instead of re-calling the LLM. The cached words are also what powers the `/history` page.

- **Location**: `GLOSSAI_DB` (default `data/glossai.db`, created on first run — the parent directory is created automatically if missing).
- **Contents**: word/phrase lookup cards (`words` table: surface form, context, the generated JSON, lookup count, timestamps) and reading-breakdown text (`explains` table, keyed by a hash of the source text). No API keys or request metadata beyond which provider/model produced each entry.
- **Reset**: delete the DB file (and its `-wal`/`-shm` siblings, from WAL mode) — glossai recreates an empty schema on the next request.

## BYOK

glossai is designed to run under your own infrastructure with your own API keys. There is no built-in proxy, usage limiting, or key management beyond reading the environment variables above at request time. If you deploy this publicly, put your own auth/rate-limiting in front of it — glossai does not include any.

## License

MIT — see [LICENSE](./LICENSE).
