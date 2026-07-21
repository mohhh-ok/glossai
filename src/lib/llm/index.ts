import { AnthropicLlmProvider } from "./anthropic";
import { ClaudeCodeProvider } from "./claude-code";
import type { LlmProvider } from "./types";

/**
 * Selects the LLM backend via `GLOSSAI_LLM_PROVIDER`:
 * - unset or "anthropic" (default): official Anthropic SDK, billed to
 *   ANTHROPIC_API_KEY.
 * - "claude-code": spawns the local `claude` CLI in headless mode, running
 *   under the operator's Claude subscription login instead of an API key.
 *   See claude-code.ts for the CLI flags and their rationale.
 */
export function getLlmProvider(): LlmProvider {
  if (process.env.GLOSSAI_LLM_PROVIDER === "claude-code") {
    return new ClaudeCodeProvider();
  }
  return new AnthropicLlmProvider();
}
