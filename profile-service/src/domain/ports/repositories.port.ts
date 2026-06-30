import { DomainEvent } from '../events/profile.events';
import { UserProfile } from '../entities/user-profile.entity';

export interface UserProfileRepository {
  save(profile: UserProfile, events: DomainEvent[]): Promise<void>;
  findById(id: string): Promise<UserProfile | null>;
  existsByUsername(username: string): Promise<boolean>;
  existsByEmail(email: string): Promise<boolean>;
}

export interface ProfileSearchHit {
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

export interface ProfileSearchResult {
  items: ProfileSearchHit[];
  total: number;
}

export interface ProfileSearchRepository {
  search(params: {
    query?: string;
    status?: string;
    limit: number;
    offset: number;
  }): Promise<ProfileSearchResult>;
  upsertVersionAware(
    id: string,
    version: number,
    document: Record<string, unknown>,
  ): Promise<boolean>;
  delete(id: string): Promise<void>;
}

export interface OutboxEventRecord {
  id: string;
  aggregateId: string;
  type: string;
  payload: Record<string, unknown>;
  version: number;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  createdAt: Date;
  publishedAt: Date | null;
}

export interface OutboxRepository {
  findPending(limit: number): Promise<OutboxEventRecord[]>;
  markPublished(id: string, publishedAt: Date): Promise<void>;
  markFailed(id: string): Promise<void>;
}

export interface EventPublisher {
  publish(event: OutboxEventRecord): Promise<void>;
}
