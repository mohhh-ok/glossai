import { resolve } from "./registry";
import type { LlmProvider } from "./types";

/**
 * Selects the LLM backend via `GLOSSAI_LLM_PROVIDER`:
 * - unset or "anthropic" (default): official Anthropic SDK, billed to
 *   ANTHROPIC_API_KEY.
 * - "claude-code": spawns the local `claude` CLI in headless mode, running
 *   under the operator's Claude subscription login instead of an API key.
 *   See claude-code.ts for the CLI flags and their rationale.
 *
 * Thin wrapper over registry.ts's resolve() — kept as the entry point route
 * handlers import, so they don't need to know the registry module exists.
 * See registry.ts to add a new backend or check the full provider list.
 */
export function getLlmProvider(): LlmProvider {
  return resolve();
}
