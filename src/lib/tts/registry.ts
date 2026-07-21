import { OpenAiTtsProvider } from "./openai";
import { SayTtsProvider } from "./say";
import { UnknownProviderError } from "./errors";
import type { TtsProvider } from "./types";

type ProviderFactory<T> = () => T;

/**
 * Adding a new TTS backend is one file plus one line: implement TtsProvider
 * (types.ts) in its own file, then register it here. Nothing else needs to
 * change.
 */
const providers: Record<string, ProviderFactory<TtsProvider>> = {
  say: () => new SayTtsProvider(),
  openai: () => new OpenAiTtsProvider(),
};

const DEFAULT_PROVIDER = "say";

/**
 * Resolves a TtsProvider by name. Resolution order when `name` is omitted:
 * the `GLOSSAI_TTS_PROVIDER` env var, then DEFAULT_PROVIDER. Throws
 * UnknownProviderError for any name not present in `providers`.
 */
export function resolve(name?: string): TtsProvider {
  const key = name ?? process.env.GLOSSAI_TTS_PROVIDER ?? DEFAULT_PROVIDER;
  const factory = providers[key];
  if (!factory) {
    throw new UnknownProviderError(key, Object.keys(providers));
  }
  return factory();
}
