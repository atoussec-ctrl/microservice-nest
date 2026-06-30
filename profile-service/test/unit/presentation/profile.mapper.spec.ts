import {
  hitToProfileType,
  toProfileType,
} from '../../../src/presentation/graphql/profile.mapper';
import { buildProfile } from '../../support/in-memory-repositories';
import { ProfileStatus } from '../../../src/domain/enums/profile.enums';

describe('presentation profile.mapper', () => {
  it('should_map_domain_profile_to_graphql_type', () => {
    const profile = buildProfile({
      id: 'p1',
      username: 'alice',
      displayName: 'Alice',
      avatarUrl: 'https://x/a.png',
    });
    const type = toProfileType(profile);
    expect(type.id).toBe('p1');
    expect(type.username).toBe('alice');
    expect(type.avatarUrl).toBe('https://x/a.png');
    expect(typeof type.createdAt).toBe('string');
  });

  it('should_map_search_hit_to_graphql_type', () => {
    const type = hitToProfileType({
      id: 'p2',
      username: 'bob',
      email: 'bob@example.com',
      displayName: 'Bob',
      avatarUrl: null,
      status: ProfileStatus.ACTIVE,
      version: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    expect(type.username).toBe('bob');
    expect(type.avatarUrl).toBeNull();
    expect(type.status).toBe(ProfileStatus.ACTIVE);
  });
});
