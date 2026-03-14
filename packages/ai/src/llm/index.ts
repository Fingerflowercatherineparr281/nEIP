/**
 * LLM client exports for @neip/ai.
 */
export {
  ClaudeLlmClient,
  createLlmClient,
  createLlmClientSync,
  ANTHROPIC_PROVIDER,
  DEFAULT_CLAUDE_MODEL,
} from './client.js';

export type { LlmClientConfig } from './client.js';
