import { SearchProfilesUseCase } from '../../../src/application/use-cases/search-profiles.use-case';
import {
  ProfileSearchRepository,
  ProfileSearchResult,
} from '../../../src/domain/ports/repositories.port';

class FakeSearchRepository implements ProfileSearchRepository {
  async search(): Promise<ProfileSearchResult> {
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
});
