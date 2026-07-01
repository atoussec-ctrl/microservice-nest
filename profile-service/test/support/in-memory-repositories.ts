import { DomainEvent } from '../../src/domain/events/profile.events';
import { UserProfile } from '../../src/domain/entities/user-profile.entity';
import {
  OutboxEventRecord,
  OutboxRepository,
  UserProfileRepository,
} from '../../src/domain/ports/repositories.port';
import { ProfileStatus } from '../../src/domain/enums/profile.enums';
import { DisplayName } from '../../src/domain/value-objects/display-name.vo';
import { Email } from '../../src/domain/value-objects/email.vo';
import { Username } from '../../src/domain/value-objects/username.vo';

export class InMemoryUserProfileRepository implements UserProfileRepository {
  private profiles = new Map<string, UserProfile>();
  private outboxEvents: OutboxEventRecord[] = [];
  private outboxIdCounter = 0;

  getOutboxEvents(): OutboxEventRecord[] {
    return [...this.outboxEvents];
  }

  async save(profile: UserProfile, events: DomainEvent[]): Promise<void> {
    this.profiles.set(profile.id, profile);
    for (const event of events) {
      this.outboxIdCounter += 1;
      this.outboxEvents.push({
        id: `outbox-${this.outboxIdCounter}`,
        aggregateId: event.aggregateId,
        type: event.type,
        payload: event.payload as unknown as Record<string, unknown>,
        version: event.version,
        status: 'PENDING',
        createdAt: event.occurredAt,
        publishedAt: null,
      });
    }
  }

  async findById(id: string): Promise<UserProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  async existsByUsername(username: string): Promise<boolean> {
    for (const profile of this.profiles.values()) {
      if (profile.username.toString() === username && !profile.isDeleted()) {
        return true;
      }
    }
    return false;
  }

  async existsByEmail(email: string): Promise<boolean> {
    for (const profile of this.profiles.values()) {
      if (profile.email.toString() === email && !profile.isDeleted()) {
        return true;
      }
    }
    return false;
  }

  seed(profile: UserProfile): void {
    this.profiles.set(profile.id, profile);
  }
}

export class InMemoryOutboxRepository implements OutboxRepository {
  constructor(private readonly profileRepo: InMemoryUserProfileRepository) {}

  async findPending(limit: number): Promise<OutboxEventRecord[]> {
    return this.profileRepo
      .getOutboxEvents()
      .filter((e) => e.status === 'PENDING')
      .slice(0, limit);
  }

  async markPublished(id: string, publishedAt: Date): Promise<void> {
    const events = this.profileRepo.getOutboxEvents();
    const event = events.find((e) => e.id === id);
    if (event) {
      event.status = 'PUBLISHED';
      event.publishedAt = publishedAt;
    }
  }

  async markFailed(id: string): Promise<void> {
    const events = this.profileRepo.getOutboxEvents();
    const event = events.find((e) => e.id === id);
    if (event) {
      event.status = 'FAILED';
    }
  }
}

export function buildProfile(overrides: Partial<{
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  status: ProfileStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}> = {}): UserProfile {
  const now = overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z');
  return UserProfile.reconstitute({
    id: overrides.id ?? 'profile-1',
    username: Username.create(overrides.username ?? 'johndoe'),
    email: Email.create(overrides.email ?? 'john@example.com'),
    displayName: DisplayName.create(overrides.displayName ?? 'John Doe'),
    avatarUrl: overrides.avatarUrl ?? null,
    status: overrides.status ?? ProfileStatus.ACTIVE,
    version: overrides.version ?? 1,
    createdAt: now,
    updatedAt: overrides.updatedAt ?? now,
  });
}
