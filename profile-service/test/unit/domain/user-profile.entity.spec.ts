import { UserProfile } from '../../../src/domain/entities/user-profile.entity';
import { ProfileStatus } from '../../../src/domain/enums/profile.enums';
import {
  ProfileAlreadyDeletedError,
  VersionConflictError,
} from '../../../src/domain/errors/domain.errors';
import { DisplayName } from '../../../src/domain/value-objects/display-name.vo';
import { Email } from '../../../src/domain/value-objects/email.vo';
import { Username } from '../../../src/domain/value-objects/username.vo';

describe('UserProfile', () => {
  const now = new Date('2024-06-01T12:00:00.000Z');

  it('should_create_profile_and_emit_ProfileCreated_event', () => {
    const profile = UserProfile.create({
      id: 'id-1',
      username: Username.create('alice'),
      email: Email.create('alice@example.com'),
      displayName: DisplayName.create('Alice'),
      now,
    });

    expect(profile.version).toBe(1);
    expect(profile.status).toBe(ProfileStatus.ACTIVE);
    const events = profile.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('PROFILE_CREATED');
    expect(events[0].version).toBe(1);
  });

  it('should_update_profile_and_increment_version', () => {
    const profile = UserProfile.create({
      id: 'id-1',
      username: Username.create('alice'),
      email: Email.create('alice@example.com'),
      displayName: DisplayName.create('Alice'),
      now,
    });
    profile.pullDomainEvents();

    const later = new Date('2024-06-02T12:00:00.000Z');
    profile.update({
      expectedVersion: 1,
      displayName: DisplayName.create('Alice Updated'),
      now: later,
    });

    expect(profile.version).toBe(2);
    expect(profile.displayName.toString()).toBe('Alice Updated');
    const events = profile.pullDomainEvents();
    expect(events[0].type).toBe('PROFILE_UPDATED');
  });

  it('should_throw_VersionConflictError_when_version_mismatch', () => {
    const profile = UserProfile.create({
      id: 'id-1',
      username: Username.create('alice'),
      email: Email.create('alice@example.com'),
      displayName: DisplayName.create('Alice'),
      now,
    });

    expect(() =>
      profile.update({
        expectedVersion: 99,
        displayName: DisplayName.create('X'),
        now,
      }),
    ).toThrow(VersionConflictError);
  });

  it('should_delete_profile_and_emit_ProfileDeleted_event', () => {
    const profile = UserProfile.create({
      id: 'id-1',
      username: Username.create('alice'),
      email: Email.create('alice@example.com'),
      displayName: DisplayName.create('Alice'),
      now,
    });
    profile.pullDomainEvents();

    profile.delete(new Date('2024-06-03T12:00:00.000Z'));
    expect(profile.isDeleted()).toBe(true);
    const events = profile.pullDomainEvents();
    expect(events[0].type).toBe('PROFILE_DELETED');
  });

  it('should_throw_when_deleting_already_deleted_profile', () => {
    const profile = UserProfile.create({
      id: 'id-1',
      username: Username.create('alice'),
      email: Email.create('alice@example.com'),
      displayName: DisplayName.create('Alice'),
      now,
    });
    profile.delete(new Date('2024-06-03T12:00:00.000Z'));

    expect(() => profile.delete(new Date('2024-06-04T12:00:00.000Z'))).toThrow(
      ProfileAlreadyDeletedError,
    );
  });
});
