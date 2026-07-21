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
- **BYOK, self-hosted** — bring your own Anthropic and OpenAI API keys; nothing is stored server-side beyond the request lifecycle.
- **Provider abstraction** — the LLM and TTS backends sit behind thin interfaces (`src/lib/llm`, `src/lib/tts`), so swapping providers doesn't touch route handlers or UI.

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
| `ANTHROPIC_API_KEY` | Yes | — | Used for reading explanations and word/phrase lookups. |
| `OPENAI_API_KEY` | Yes (for audio) | — | Used for text-to-speech playback. Without it, the app still works but speaker buttons return an error. |
| `GLOSSAI_MODEL` | No | `claude-opus-4-8` | Anthropic model used for both the explain and word-lookup endpoints. |
| `GLOSSAI_TTS_VOICE` | No | `alloy` | OpenAI TTS voice (`gpt-4o-mini-tts`). |

## BYOK

glossai is designed to run under your own infrastructure with your own API keys. There is no built-in proxy, usage limiting, or key management beyond reading the environment variables above at request time. If you deploy this publicly, put your own auth/rate-limiting in front of it — glossai does not include any.

## License

MIT — see [LICENSE](./LICENSE).
