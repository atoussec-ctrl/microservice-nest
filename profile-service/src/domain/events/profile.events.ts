export interface DomainEventPayload {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DomainEvent {
  aggregateId: string;
  type: string;
  version: number;
  payload: DomainEventPayload;
  occurredAt: Date;
}

export abstract class BaseDomainEvent implements DomainEvent {
  constructor(
    public readonly aggregateId: string,
    public readonly type: string,
    public readonly version: number,
    public readonly payload: DomainEventPayload,
    public readonly occurredAt: Date,
  ) {}
}

export class ProfileCreatedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    payload: DomainEventPayload,
    occurredAt: Date,
  ) {
    super(aggregateId, 'PROFILE_CREATED', version, payload, occurredAt);
  }
}

export class ProfileUpdatedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    payload: DomainEventPayload,
    occurredAt: Date,
  ) {
    super(aggregateId, 'PROFILE_UPDATED', version, payload, occurredAt);
  }
}

export class ProfileDeletedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    payload: DomainEventPayload,
    occurredAt: Date,
  ) {
    super(aggregateId, 'PROFILE_DELETED', version, payload, occurredAt);
  }
}
