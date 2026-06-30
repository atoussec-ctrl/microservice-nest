import {
  toDomainProfile,
  toPrismaStatus,
} from '../../../src/infrastructure/persistence/profile.mapper';
import { ProfileStatus as PrismaProfileStatus } from '@prisma/client';
import { ProfileStatus } from '../../../src/domain/enums/profile.enums';

describe('persistence profile.mapper', () => {
  it('should_map_active_record_to_domain', () => {
    const profile = toDomainProfile({
      id: 'p1',
      username: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
      avatarUrl: 'https://x/a.png',
      status: PrismaProfileStatus.ACTIVE,
      version: 2,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    });
    expect(profile.id).toBe('p1');
    expect(profile.isDeleted()).toBe(false);
    expect(profile.avatarUrl).toBe('https://x/a.png');
  });

  it('should_mark_inactive_record_as_deleted', () => {
    const profile = toDomainProfile({
      id: 'p2',
      username: 'bob',
      email: 'bob@example.com',
      displayName: 'Bob',
      avatarUrl: null,
      status: PrismaProfileStatus.INACTIVE,
      version: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(profile.isDeleted()).toBe(true);
  });

  it('should_pass_through_domain_status_to_prisma_status', () => {
    expect(toPrismaStatus(ProfileStatus.SUSPENDED)).toBe(
      PrismaProfileStatus.SUSPENDED,
    );
  });
});
