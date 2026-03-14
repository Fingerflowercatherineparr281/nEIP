/**
 * Events barrel export — Stories 2.3, 13.3.
 */

export { EventStore } from './event-store.js';
export type { AppendEventInput } from './event-store.js';

// Event Replay (Story 13.3 — NPAEs/PAEs)
export { replay } from './event-replay.js';
export type { ReplayResult, AccountBalance } from './event-replay.js';

// Interpretation Rules (Story 13.3)
export {
  NPAES_RULES,
  PAES_RULES,
  getDefaultRules,
} from './interpretation-rules.js';
export type {
  AccountingStandard,
  MaterializedEntry,
  RuleContext,
  Rule,
  InterpretationRules,
} from './interpretation-rules.js';
