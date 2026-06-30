import { UserProfile } from '../../../src/domain/entities/user-profile.entity';
import { ProfileStatus } from '../../../src/domain/enums/profile.enums';
import { ProfileAlreadyDeletedError } from '../../../src/domain/errors/domain.errors';
import { DisplayName } from '../../../src/domain/value-objects/display-name.vo';
import { Email } from '../../../src/domain/value-objects/email.vo';
import { Username } from '../../../src/domain/value-objects/username.vo';

function makeProfile(): UserProfile {
  const profile = UserProfile.create({
    id: 'id-1',
    username: Username.create('alice'),
    email: Email.create('alice@example.com'),
    displayName: DisplayName.create('Alice'),
    now: new Date('2024-01-01T00:00:00.000Z'),
  });
  profile.pullDomainEvents();
  return profile;
}

describe('UserProfile update branches', () => {
  it('should_update_only_avatarUrl_when_provided', () => {
    const profile = makeProfile();
    profile.update({
      expectedVersion: 1,
      avatarUrl: 'https://cdn.example.com/a.png',
      now: new Date('2024-01-02T00:00:00.000Z'),
    });
    expect(profile.avatarUrl).toBe('https://cdn.example.com/a.png');
    expect(profile.version).toBe(2);
  });

  it('should_clear_avatarUrl_when_set_to_null', () => {
    const profile = makeProfile();
    profile.update({ expectedVersion: 1, avatarUrl: null, now: new Date() });
    expect(profile.avatarUrl).toBeNull();
  });

  it('should_bump_version_even_with_no_field_changes', () => {
    const profile = makeProfile();
    profile.update({ expectedVersion: 1, now: new Date() });
    expect(profile.version).toBe(2);
  });

  it('should_update_status_only', () => {
    const profile = makeProfile();
    profile.update({
      expectedVersion: 1,
      status: ProfileStatus.SUSPENDED,
      now: new Date(),
    });
    expect(profile.status).toBe(ProfileStatus.SUSPENDED);
  });

  it('should_throw_when_updating_deleted_profile', () => {
    const profile = makeProfile();
    profile.delete(new Date('2024-01-03T00:00:00.000Z'));
    expect(() =>
      profile.update({
        expectedVersion: 2,
        displayName: DisplayName.create('X'),
        now: new Date(),
      }),
    ).toThrow(ProfileAlreadyDeletedError);
  });

  it('should_reconstitute_deleted_profile_from_inactive_status', () => {
    const profile = UserProfile.reconstitute({
      id: 'id-9',
      username: Username.create('bob'),
      email: Email.create('bob@example.com'),
      displayName: DisplayName.create('Bob'),
      avatarUrl: null,
      status: ProfileStatus.INACTIVE,
      version: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: true,
    });
    expect(profile.isDeleted()).toBe(true);
  });
});
