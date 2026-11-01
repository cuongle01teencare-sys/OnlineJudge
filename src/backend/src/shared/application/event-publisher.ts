import type { DomainEvent } from '../domain/aggregate-root.js';

/** Port: publishes domain/integration events to other bounded contexts (in-process). */
export abstract class EventPublisher {
  abstract publish(events: DomainEvent[]): Promise<void>;
}
