import { OpenSearchBootstrapService } from '../../../src/infrastructure/search/opensearch-bootstrap.service';
import { OpenSearchProfileRepository } from '../../../src/infrastructure/search/opensearch-profile.repository';
import { InMemoryProfileSearchRepository, InMemoryOpenSearchIndex } from '../../../src/infrastructure/search/opensearch-profile.repository';

describe('OpenSearchBootstrapService', () => {
  it('should_ensure_index_when_repository_is_opensearch_backed', async () => {
    const client = { indices: {} } as never;
    const repository = new OpenSearchProfileRepository(client, 'profiles-v1');
    repository.ensureIndex = jest.fn().mockResolvedValue(undefined);
    const service = new OpenSearchBootstrapService(repository);

    await service.onModuleInit();

    expect(repository.ensureIndex).toHaveBeenCalledTimes(1);
  });

  it('should_log_error_when_ensure_index_fails', async () => {
    const client = { indices: {} } as never;
    const repository = new OpenSearchProfileRepository(client, 'profiles-v1');
    repository.ensureIndex = jest.fn().mockRejectedValue(new Error('cluster unreachable'));
    const service = new OpenSearchBootstrapService(repository);

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(repository.ensureIndex).toHaveBeenCalledTimes(1);
  });

  it('should_skip_bootstrap_for_non_opensearch_repositories', async () => {
    const inMemoryIndex = new InMemoryOpenSearchIndex();
    const repository = new InMemoryProfileSearchRepository(inMemoryIndex);
    const service = new OpenSearchBootstrapService(repository);

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
