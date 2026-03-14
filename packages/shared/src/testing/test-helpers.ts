/**
 * Given-When-Then test helper utilities for event sourcing tests.
 *
 * Provides a fluent, readable BDD-style API for structuring unit and
 * integration tests around domain events and aggregates.
 *
 * Architecture references:
 *   AR16 — Event Sourcing
 *   AR29 — Given-When-Then pattern for domain tests
 *
 * @example
 * ```typescript
 * import { given, when, then } from '@neip/shared/testing';
 *
 * describe('InvoiceAggregate', () => {
 *   it('should emit InvoiceCreated when creating an invoice', async () => {
 *     const ctx = given([])                           // no prior events
 *       .when(() => InvoiceAggregate.create(input))   // command
 *       .then(events => {                             // assertions
 *         then(events).containsEvent('invoice.created');
 *       });
 *   });
 * });
 * ```
 */

import type { DomainEvent } from '../types/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A function that represents a command returning domain events */
export type CommandFn<TEvent extends DomainEvent = DomainEvent> = () =>
  | TEvent[]
  | Promise<TEvent[]>
  | TEvent
  | Promise<TEvent>;

/** A synchronous or asynchronous assertion function */
export type AssertionFn<TEvent extends DomainEvent = DomainEvent> = (
  events: TEvent[],
) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Fluent builder — Given → When → Then
// ---------------------------------------------------------------------------

/**
 * The result of a `when()` call: holds the produced events
 * and exposes `then()` for assertions.
 */
export interface WhenResult<TEvent extends DomainEvent = DomainEvent> {
  /** Events produced by the command */
  readonly events: TEvent[];
  /** Run assertion(s) against the produced events */
  then(assertionFn: AssertionFn<TEvent>): Promise<void>;
}

/**
 * The result of a `given()` call: holds prior-state events
 * and exposes `when()` to issue a command.
 */
export interface GivenResult<TEvent extends DomainEvent = DomainEvent> {
  /** Prior-state events (history) */
  readonly history: TEvent[];
  /** Issue a command and capture the resulting events */
  when(commandFn: CommandFn<TEvent>): Promise<WhenResult<TEvent>>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Start a Given-When-Then scenario with a set of prior-state (history) events.
 *
 * @param history - Domain events representing the pre-existing state of the aggregate.
 *
 * @example
 * ```typescript
 * const scenario = await given([createdEvent])
 *   .when(() => aggregate.addLineItem(item))
 *   .then(events => {
 *     expect(events).toHaveLength(1);
 *     expect(events[0]?.type).toBe('invoice.line_item_added');
 *   });
 * ```
 */
export function given<TEvent extends DomainEvent = DomainEvent>(
  history: TEvent[] = [],
): GivenResult<TEvent> {
  return {
    history,

    async when(commandFn: CommandFn<TEvent>): Promise<WhenResult<TEvent>> {
      const result = await commandFn();
      const events: TEvent[] = Array.isArray(result) ? result : [result];

      return {
        events,

        async then(assertionFn: AssertionFn<TEvent>): Promise<void> {
          await assertionFn(events);
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Wraps an events array and exposes fluent assertion helpers
 * suitable for event-sourcing domain tests.
 *
 * @example
 * ```typescript
 * expectEvents(events)
 *   .toHaveLength(1)
 *   .toContainEventType('invoice.created');
 * ```
 */
export interface EventAssertions<TEvent extends DomainEvent = DomainEvent> {
  /** Assert the exact number of events emitted */
  toHaveLength(expected: number): EventAssertions<TEvent>;
  /** Assert that at least one event with the given type was emitted */
  toContainEventType(type: string): EventAssertions<TEvent>;
  /** Assert that NO event with the given type was emitted */
  notToContainEventType(type: string): EventAssertions<TEvent>;
  /** Assert all events share the same tenantId */
  toShareTenantId(tenantId: string): EventAssertions<TEvent>;
  /** Assert that every event has a valid (non-empty) id */
  toHaveValidIds(): EventAssertions<TEvent>;
  /** Access the raw events array for custom assertions */
  readonly events: TEvent[];
}

/**
 * Create fluent event assertions around a list of domain events.
 *
 * Throws descriptive errors on assertion failures — designed to integrate
 * with any test runner (Vitest, Jest, etc.) by relying only on `throw`.
 *
 * @param events - The domain events to assert against.
 */
export function expectEvents<TEvent extends DomainEvent = DomainEvent>(
  events: TEvent[],
): EventAssertions<TEvent> {
  const assertions: EventAssertions<TEvent> = {
    events,

    toHaveLength(expected: number): EventAssertions<TEvent> {
      if (events.length !== expected) {
        throw new Error(
          `Expected ${expected} event(s) but got ${events.length}.\n` +
            `Events: ${events.map((e) => e.type).join(', ')}`,
        );
      }
      return assertions;
    },

    toContainEventType(type: string): EventAssertions<TEvent> {
      const found = events.some((e) => e.type === type);
      if (!found) {
        const types = events.map((e) => e.type).join(', ') || '(none)';
        throw new Error(
          `Expected events to contain type "${type}" but only found: ${types}`,
        );
      }
      return assertions;
    },

    notToContainEventType(type: string): EventAssertions<TEvent> {
      const found = events.some((e) => e.type === type);
      if (found) {
        throw new Error(`Expected events NOT to contain type "${type}" but it was found.`);
      }
      return assertions;
    },

    toShareTenantId(tenantId: string): EventAssertions<TEvent> {
      const mismatched = events.filter((e) => e.tenantId !== tenantId);
      if (mismatched.length > 0) {
        throw new Error(
          `Expected all events to have tenantId "${tenantId}" but ` +
            `${mismatched.length} event(s) did not match.`,
        );
      }
      return assertions;
    },

    toHaveValidIds(): EventAssertions<TEvent> {
      const invalid = events.filter((e) => !e.id || e.id.trim() === '');
      if (invalid.length > 0) {
        throw new Error(
          `Expected all events to have valid ids but ${invalid.length} event(s) had empty ids.`,
        );
      }
      return assertions;
    },
  };

  return assertions;
}

// ---------------------------------------------------------------------------
// Convenience re-export of the `when` standalone helper
// (for scenarios that do not need prior state)
// ---------------------------------------------------------------------------

/**
 * Shorthand for `given([]).when(commandFn)` — use when there is no prior state.
 *
 * @example
 * ```typescript
 * const result = await whenCommand(() => aggregate.create(input));
 * result.then(events => expectEvents(events).toHaveLength(1));
 * ```
 */
export async function whenCommand<TEvent extends DomainEvent = DomainEvent>(
  commandFn: CommandFn<TEvent>,
): Promise<WhenResult<TEvent>> {
  return given<TEvent>([]).when(commandFn);
}
