import { AnthropicLlmProvider } from "./anthropic";
import { ClaudeCodeProvider } from "./claude-code";
import { UnknownProviderError } from "./errors";
import type { LlmProvider } from "./types";

type ProviderFactory<T> = () => T;

/**
 * Adding a new LLM backend is one file plus one line: implement LlmProvider
 * (types.ts) in its own file, then register it here. Nothing else — routes,
 * getLlmProvider() (index.ts) — needs to change.
 */
const providers: Record<string, ProviderFactory<LlmProvider>> = {
  anthropic: () => new AnthropicLlmProvider(),
  "claude-code": () => new ClaudeCodeProvider(),
};

const DEFAULT_PROVIDER = "anthropic";

/**
 * Resolves an LlmProvider by name. Resolution order when `name` is omitted:
 * the `GLOSSAI_LLM_PROVIDER` env var, then DEFAULT_PROVIDER. Throws
 * UnknownProviderError for any name not present in `providers`.
 */
export function resolve(name?: string): LlmProvider {
  const key = name ?? process.env.GLOSSAI_LLM_PROVIDER ?? DEFAULT_PROVIDER;
  const factory = providers[key];
  if (!factory) {
    throw new UnknownProviderError(key, Object.keys(providers));
  }
  return factory();
}
