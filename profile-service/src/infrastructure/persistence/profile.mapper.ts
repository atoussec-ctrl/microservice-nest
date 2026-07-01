import { ProfileStatus as PrismaProfileStatus } from '@prisma/client';
import { ProfileStatus } from '../../domain/enums/profile.enums';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { DisplayName } from '../../domain/value-objects/display-name.vo';
import { Email } from '../../domain/value-objects/email.vo';
import { Username } from '../../domain/value-objects/username.vo';

export function toDomainProfile(record: {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  status: PrismaProfileStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): UserProfile {
  return UserProfile.reconstitute({
    id: record.id,
    username: Username.create(record.username),
    email: Email.create(record.email),
    displayName: DisplayName.create(record.displayName),
    avatarUrl: record.avatarUrl,
    status: record.status as ProfileStatus,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deleted: record.status === ProfileStatus.INACTIVE,
  });
}

export function toPrismaStatus(status: ProfileStatus): PrismaProfileStatus {
  return status as PrismaProfileStatus;
}

/** Frees unique username/email slots after soft-delete while keeping the row for audit. */
export function toPersistedUsername(profile: UserProfile): string {
  if (!profile.isDeleted()) {
    return profile.username.toString();
  }
  const suffix = profile.id.replace(/-/g, '').slice(0, 22);
  return `del_${suffix}`;
}

export function toPersistedEmail(profile: UserProfile): string {
  if (!profile.isDeleted()) {
    return profile.email.toString();
  }
  return `deleted+${profile.id}@released.invalid`;
}
