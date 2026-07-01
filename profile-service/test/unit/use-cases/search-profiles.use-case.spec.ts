import { SearchProfilesUseCase } from '../../../src/application/use-cases/search-profiles.use-case';
import {
  ProfileSearchRepository,
  ProfileSearchResult,
} from '../../../src/domain/ports/repositories.port';

class FakeSearchRepository implements ProfileSearchRepository {
  lastParams: {
    query?: string;
    status?: string;
    limit: number;
    offset: number;
  } | null = null;

  async search(params: {
    query?: string;
    status?: string;
    limit: number;
    offset: number;
  }): Promise<ProfileSearchResult> {
    this.lastParams = params;
    return {
      items: [
        {
          id: 'p1',
          username: 'alice',
          email: 'alice@example.com',
          displayName: 'Alice',
          avatarUrl: null,
          status: 'ACTIVE',
          version: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
    };
  }

  async upsertVersionAware(): Promise<boolean> {
    return true;
  }

  async delete(): Promise<void> {}
}

describe('SearchProfilesUseCase', () => {
  it('should_delegate_to_search_repository', async () => {
    const useCase = new SearchProfilesUseCase(new FakeSearchRepository());
    const result = await useCase.execute({ query: 'alice' });
    expect(result.total).toBe(1);
    expect(result.items[0].username).toBe('alice');
  });

  it('should_default_limit_and_offset_when_not_provided', async () => {
    const repository = new FakeSearchRepository();
    const useCase = new SearchProfilesUseCase(repository);
    await useCase.execute({});
    expect(repository.lastParams).toEqual({
      query: undefined,
      status: undefined,
      limit: 20,
      offset: 0,
    });
  });

  it('should_clamp_limit_to_max_100_when_a_larger_value_is_requested', async () => {
    const repository = new FakeSearchRepository();
    const useCase = new SearchProfilesUseCase(repository);
    await useCase.execute({ limit: 999999 });
    expect(repository.lastParams?.limit).toBe(100);
  });

  it('should_clamp_limit_to_min_1_when_a_non_positive_value_is_requested', async () => {
    const repository = new FakeSearchRepository();
    const useCase = new SearchProfilesUseCase(repository);
    await useCase.execute({ limit: -5 });
    expect(repository.lastParams?.limit).toBe(1);
  });

  it('should_clamp_offset_to_min_0_when_a_negative_value_is_requested', async () => {
    const repository = new FakeSearchRepository();
    const useCase = new SearchProfilesUseCase(repository);
    await useCase.execute({ offset: -10 });
    expect(repository.lastParams?.offset).toBe(0);
  });
});
