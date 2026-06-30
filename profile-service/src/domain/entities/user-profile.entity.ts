import { ProfileStatus } from '../enums/profile.enums';
import {
  ProfileAlreadyDeletedError,
  VersionConflictError,
} from '../errors/domain.errors';
import {
  DomainEvent,
  DomainEventPayload,
  ProfileCreatedEvent,
  ProfileDeletedEvent,
  ProfileUpdatedEvent,
} from '../events/profile.events';
import { DisplayName } from '../value-objects/display-name.vo';
import { Email } from '../value-objects/email.vo';
import { Username } from '../value-objects/username.vo';

export interface CreateProfileProps {
  id: string;
  username: Username;
  email: Email;
  displayName: DisplayName;
  avatarUrl?: string | null;
  now: Date;
}

export interface UpdateProfileProps {
  expectedVersion: number;
  displayName?: DisplayName;
  avatarUrl?: string | null;
  status?: ProfileStatus;
  now: Date;
}

export class UserProfile {
  private domainEvents: DomainEvent[] = [];

  private constructor(
    public readonly id: string,
    public readonly username: Username,
    public readonly email: Email,
    public displayName: DisplayName,
    public avatarUrl: string | null,
    public status: ProfileStatus,
    public version: number,
    public readonly createdAt: Date,
    public updatedAt: Date,
    private deleted: boolean,
  ) {}

  static create(props: CreateProfileProps): UserProfile {
    const profile = new UserProfile(
      props.id,
      props.username,
      props.email,
      props.displayName,
      props.avatarUrl ?? null,
      ProfileStatus.ACTIVE,
      1,
      props.now,
      props.now,
      false,
    );
    profile.recordEvent(
      new ProfileCreatedEvent(
        profile.id,
        profile.version,
        profile.toPayload(),
        props.now,
      ),
    );
    return profile;
  }

  static reconstitute(data: {
    id: string;
    username: Username;
    email: Email;
    displayName: DisplayName;
    avatarUrl: string | null;
    status: ProfileStatus;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    deleted?: boolean;
  }): UserProfile {
    return new UserProfile(
      data.id,
      data.username,
      data.email,
      data.displayName,
      data.avatarUrl,
      data.status,
      data.version,
      data.createdAt,
      data.updatedAt,
      data.deleted ?? false,
    );
  }

  update(props: UpdateProfileProps): void {
    if (this.deleted) {
      throw new ProfileAlreadyDeletedError(this.id);
    }
    if (this.version !== props.expectedVersion) {
      throw new VersionConflictError(props.expectedVersion, this.version);
    }

    if (props.displayName !== undefined) {
      this.displayName = props.displayName;
    }
    if (props.avatarUrl !== undefined) {
      this.avatarUrl = props.avatarUrl;
    }
    if (props.status !== undefined) {
      this.status = props.status;
    }

    this.version += 1;
    this.updatedAt = props.now;
    this.recordEvent(
      new ProfileUpdatedEvent(
        this.id,
        this.version,
        this.toPayload(),
        props.now,
      ),
    );
  }

  delete(now: Date): void {
    if (this.deleted) {
      throw new ProfileAlreadyDeletedError(this.id);
    }
    this.deleted = true;
    this.status = ProfileStatus.INACTIVE;
    this.version += 1;
    this.updatedAt = now;
    this.recordEvent(
      new ProfileDeletedEvent(this.id, this.version, this.toPayload(), now),
    );
  }

  isDeleted(): boolean {
    return this.deleted;
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }

  private recordEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  toPayload(): DomainEventPayload {
    return {
      id: this.id,
      username: this.username.toString(),
      email: this.email.toString(),
      displayName: this.displayName.toString(),
      avatarUrl: this.avatarUrl,
      status: this.status,
      version: this.version,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
