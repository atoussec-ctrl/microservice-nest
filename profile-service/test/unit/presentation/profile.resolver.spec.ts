import { ProfileResolver } from '../../../src/presentation/graphql/profile.resolver';
import { CreateProfileUseCase } from '../../../src/application/use-cases/create-profile.use-case';
import { UpdateProfileUseCase } from '../../../src/application/use-cases/update-profile.use-case';
import { DeleteProfileUseCase } from '../../../src/application/use-cases/delete-profile.use-case';
import { GetProfileByIdUseCase } from '../../../src/application/use-cases/get-profile-by-id.use-case';
import { SearchProfilesUseCase } from '../../../src/application/use-cases/search-profiles.use-case';
import {
  ForbiddenProfileAccessError,
  ProfileNotFoundError,
} from '../../../src/domain/errors/domain.errors';
import { ProfileStatus } from '../../../src/domain/enums/profile.enums';
import { FakeClock } from '../../support/fake-clock';
import { FakeIdGenerator } from '../../support/fake-id-generator';
import { FakeTokenIssuer } from '../../support/fake-token-issuer';
import {
  buildProfile,
  InMemoryUserProfileRepository,
} from '../../support/in-memory-repositories';
import {
  InMemoryOpenSearchIndex,
  InMemoryProfileSearchRepository,
} from '../../../src/infrastructure/search/opensearch-profile.repository';

describe('ProfileResolver', () => {
  let repo: InMemoryUserProfileRepository;
  let searchIndex: InMemoryOpenSearchIndex;
  let resolver: ProfileResolver;
  const clock = new FakeClock(new Date('2024-06-01T00:00:00.000Z'));

  beforeEach(() => {
    repo = new InMemoryUserProfileRepository();
    searchIndex = new InMemoryOpenSearchIndex();
    const searchRepo = new InMemoryProfileSearchRepository(searchIndex);
    resolver = new ProfileResolver(
      new CreateProfileUseCase(
        repo,
        clock,
        new FakeIdGenerator(['p-new']),
        new FakeTokenIssuer(),
      ),
      new UpdateProfileUseCase(repo, clock),
      new DeleteProfileUseCase(repo, clock),
      new GetProfileByIdUseCase(repo),
      new SearchProfilesUseCase(searchRepo),
    );
  });

  it('should_create_profile_and_return_an_access_token', async () => {
    const result = await resolver.createProfile({
      username: 'newuser',
      email: 'new@example.com',
      displayName: 'New User',
    });
    expect(result.profile.id).toBe('p-new');
    expect(result.accessToken).toBe('fake-token-for-p-new');
  });

  it('should_return_profile_by_id', async () => {
    repo.seed(buildProfile({ id: 'p1', username: 'alice' }));
    const found = await resolver.profile('p1');
    expect(found?.username).toBe('alice');
  });

  it('should_return_null_when_profile_not_found', async () => {
    const found = await resolver.profile('missing');
    expect(found).toBeNull();
  });

  it('should_rethrow_non_domain_errors_from_profile_query', async () => {
    const throwingUseCase = {
      execute: jest.fn().mockRejectedValue(new Error('infra failure')),
    } as unknown as GetProfileByIdUseCase;
    const r = new ProfileResolver(
      {} as CreateProfileUseCase,
      {} as UpdateProfileUseCase,
      {} as DeleteProfileUseCase,
      throwingUseCase,
      {} as SearchProfilesUseCase,
    );
    await expect(r.profile('p1')).rejects.toThrow('infra failure');
  });

  it('should_update_profile_when_the_caller_owns_it', async () => {
    repo.seed(buildProfile({ id: 'p1', version: 1 }));
    const updated = await resolver.updateProfile(
      {
        id: 'p1',
        version: 1,
        displayName: 'Updated',
        status: ProfileStatus.SUSPENDED,
      },
      'p1',
    );
    expect(updated.version).toBe(2);
    expect(updated.displayName).toBe('Updated');
  });

  it('should_reject_update_when_the_caller_does_not_own_the_profile', async () => {
    repo.seed(buildProfile({ id: 'p1', version: 1 }));
    await expect(
      resolver.updateProfile(
        { id: 'p1', version: 1, displayName: 'Hijacked' },
        'someone-else',
      ),
    ).rejects.toThrow(ForbiddenProfileAccessError);
  });

  it('should_delete_profile_when_the_caller_owns_it', async () => {
    repo.seed(buildProfile({ id: 'p1' }));
    expect(await resolver.deleteProfile('p1', 'p1')).toBe(true);
  });

  it('should_reject_delete_when_the_caller_does_not_own_the_profile', async () => {
    repo.seed(buildProfile({ id: 'p1' }));
    await expect(resolver.deleteProfile('p1', 'someone-else')).rejects.toThrow(
      ForbiddenProfileAccessError,
    );
  });

  it('should_propagate_not_found_on_delete', async () => {
    await expect(resolver.deleteProfile('missing', 'missing')).rejects.toThrow(
      ProfileNotFoundError,
    );
  });

  it('should_search_profiles', async () => {
    searchIndex.upsertVersionAware('p1', 1, {
      id: 'p1',
      username: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
      avatarUrl: null,
      status: 'ACTIVE',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    const result = await resolver.searchProfiles('alice', undefined, 10, 0);
    expect(result.total).toBe(1);
    expect(result.items[0].username).toBe('alice');
  });
});
