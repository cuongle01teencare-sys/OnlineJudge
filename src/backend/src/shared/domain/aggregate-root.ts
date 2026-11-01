import { randomUUID } from 'node:crypto';

export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
}

export abstract class AggregateRoot<TId = string> {
  private events: DomainEvent[] = [];

  protected constructor(readonly id: TId) {}

  protected record(event: DomainEvent): void {
    this.events.push(event);
  }

  /** Returns and clears recorded events; called by application services after persisting. */
  pullEvents(): DomainEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
}

export const newId = (): string => randomUUID();
