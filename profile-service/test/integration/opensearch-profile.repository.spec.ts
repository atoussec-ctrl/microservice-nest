import {
  InMemoryOpenSearchIndex,
  InMemoryProfileSearchRepository,
  OpenSearchProfileRepository,
} from '../../src/infrastructure/search/opensearch-profile.repository';

const doc = {
  id: 'p1',
  username: 'alice',
  email: 'alice@example.com',
  displayName: 'Alice',
  avatarUrl: null,
  status: 'ACTIVE',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('OpenSearchProfileRepository (mocked client)', () => {
  function makeClient() {
    return {
      search: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    };
  }

  it('should_build_match_all_query_when_no_filters', async () => {
    const client = makeClient();
    client.search.mockResolvedValue({
      body: { hits: { total: { value: 0 }, hits: [] } },
    });
    const repo = new OpenSearchProfileRepository(client as never, 'profiles-v1');

    const result = await repo.search({ limit: 10, offset: 0 });

    expect(result.total).toBe(0);
    const body = client.search.mock.calls[0][0].body;
    expect(body.query).toEqual({ match_all: {} });
  });

  it('should_build_bool_query_with_text_and_status', async () => {
    const client = makeClient();
    client.search.mockResolvedValue({
      body: { hits: { total: { value: 1 }, hits: [{ _source: doc }] } },
    });
    const repo = new OpenSearchProfileRepository(client as never, 'profiles-v1');

    const result = await repo.search({
      query: 'ali',
      status: 'ACTIVE',
      limit: 5,
      offset: 0,
    });

    expect(result.items[0].username).toBe('alice');
    const must = client.search.mock.calls[0][0].body.query.bool.must;
    expect(must).toHaveLength(2);
  });

  it('should_handle_numeric_total_shape', async () => {
    const client = makeClient();
    client.search.mockResolvedValue({
      body: { hits: { total: 3, hits: [{ _source: doc }] } },
    });
    const repo = new OpenSearchProfileRepository(client as never, 'profiles-v1');
    const result = await repo.search({ limit: 10, offset: 0 });
    expect(result.total).toBe(3);
  });

  it('should_return_true_on_successful_upsert', async () => {
    const client = makeClient();
    const repo = new OpenSearchProfileRepository(client as never, 'profiles-v1');
    const ok = await repo.upsertVersionAware('p1', 2, doc);
    expect(ok).toBe(true);
    expect(client.update).toHaveBeenCalled();
  });

  it('should_return_false_when_upsert_throws', async () => {
    const client = makeClient();
    client.update.mockRejectedValue(new Error('conflict'));
    const repo = new OpenSearchProfileRepository(client as never, 'profiles-v1');
    const ok = await repo.upsertVersionAware('p1', 2, doc);
    expect(ok).toBe(false);
  });

  it('should_swallow_delete_errors_for_idempotency', async () => {
    const client = makeClient();
    client.delete.mockRejectedValue(new Error('not found'));
    const repo = new OpenSearchProfileRepository(client as never, 'profiles-v1');
    await expect(repo.delete('p1')).resolves.toBeUndefined();
  });

  it('should_default_index_name_from_env', () => {
    process.env.OPENSEARCH_INDEX = 'profiles-env';
    const repo = new OpenSearchProfileRepository(makeClient() as never);
    expect(repo).toBeInstanceOf(OpenSearchProfileRepository);
    delete process.env.OPENSEARCH_INDEX;
  });
});

describe('InMemoryProfileSearchRepository', () => {
  it('should_delegate_to_in_memory_index', async () => {
    const index = new InMemoryOpenSearchIndex();
    const repo = new InMemoryProfileSearchRepository(index);

    expect(await repo.upsertVersionAware('p1', 1, doc)).toBe(true);
    expect(await repo.upsertVersionAware('p1', 1, doc)).toBe(false);

    const found = await repo.search({ query: 'ali', limit: 10, offset: 0 });
    expect(found.total).toBe(1);

    const byStatus = await repo.search({
      status: 'INACTIVE',
      limit: 10,
      offset: 0,
    });
    expect(byStatus.total).toBe(0);

    await repo.delete('p1');
    const afterDelete = await repo.search({ limit: 10, offset: 0 });
    expect(afterDelete.total).toBe(0);
  });
});
