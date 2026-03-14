/**
 * DomainEvent<T> — base contract for all domain events in nEIP.
 * Architecture reference: AR16 (Event Sourcing)
 *
 * id uses uuidv7 format (time-sortable). Generation happens in the domain
 * layer; this package only types the shape.
 */
export interface DomainEvent<T = unknown> {
  /** UUIDv7 — time-sortable unique identifier for the event */
  readonly id: string;
  /** Fully-qualified event type name, e.g. "invoice.created" */
  readonly type: string;
  /** Tenant identifier for multi-tenancy isolation */
  readonly tenantId: string;
  /** Domain-specific event payload */
  readonly payload: T;
  /** Monotonically increasing version for optimistic concurrency control */
  readonly version: number;
  /** Wall-clock time when the event occurred */
  readonly timestamp: Date;
}
