import { UserProfile } from '../../domain/entities/user-profile.entity';
import { ProfileSearchHit } from '../../domain/ports/repositories.port';
import { ProfileType } from './profile.types';

export function toProfileType(profile: UserProfile): ProfileType {
  return {
    id: profile.id,
    username: profile.username.toString(),
    email: profile.email.toString(),
    displayName: profile.displayName.toString(),
    avatarUrl: profile.avatarUrl,
    status: profile.status,
    version: profile.version,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export function hitToProfileType(hit: ProfileSearchHit): ProfileType {
  return {
    id: hit.id,
    username: hit.username,
    email: hit.email,
    displayName: hit.displayName,
    avatarUrl: hit.avatarUrl,
    status: hit.status as ProfileType['status'],
    version: hit.version,
    createdAt: hit.createdAt,
    updatedAt: hit.updatedAt,
  };
}
