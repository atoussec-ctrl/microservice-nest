import { ProfileIndexConsumer } from '../../src/infrastructure/messaging/profile-index.consumer';
import { InMemoryOpenSearchIndex } from '../../src/infrastructure/search/opensearch-profile.repository';

describe('ProfileIndexConsumer', () => {
  let index: InMemoryOpenSearchIndex;
  let consumer: ProfileIndexConsumer;

  beforeEach(() => {
    index = new InMemoryOpenSearchIndex();
    const searchRepo = {
      search: (params: Parameters<InMemoryOpenSearchIndex['search']>[0]) =>
        Promise.resolve(index.search(params)),
      upsertVersionAware: (
        id: string,
        version: number,
        doc: Record<string, unknown>,
      ) => Promise.resolve(index.upsertVersionAware(id, version, doc)),
      delete: (id: string) => {
        index.delete(id);
        return Promise.resolve();
      },
    };
    consumer = new ProfileIndexConsumer(searchRepo);
  });

  const basePayload = {
    id: 'profile-1',
    username: 'alice',
    email: 'alice@example.com',
    displayName: 'Alice',
    avatarUrl: null,
    status: 'ACTIVE',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  it('should_index_profile_on_PROFILE_CREATED', async () => {
    await consumer.handleMessage({
      aggregateId: 'profile-1',
      type: 'PROFILE_CREATED',
      version: 1,
      payload: { ...basePayload, version: 1 },
    });

    const doc = index.get('profile-1');
    expect(doc?.version).toBe(1);
    expect(doc?.displayName).toBe('Alice');
  });

  it('should_keep_higher_version_when_out_of_order_UPDATED_v3_before_CREATED_v1', async () => {
    await consumer.handleMessage({
      aggregateId: 'profile-1',
      type: 'PROFILE_UPDATED',
      version: 3,
      payload: { ...basePayload, displayName: 'Alice v3', version: 3 },
    });

    await consumer.handleMessage({
      aggregateId: 'profile-1',
      type: 'PROFILE_CREATED',
      version: 1,
      payload: { ...basePayload, displayName: 'Alice v1', version: 1 },
    });

    const doc = index.get('profile-1');
    expect(doc?.version).toBe(3);
    expect(doc?.displayName).toBe('Alice v3');
  });

  it('should_ignore_duplicate_same_version_event', async () => {
    await consumer.handleMessage({
      aggregateId: 'profile-1',
      type: 'PROFILE_UPDATED',
      version: 2,
      payload: { ...basePayload, displayName: 'First', version: 2 },
    });

    await consumer.handleMessage({
      aggregateId: 'profile-1',
      type: 'PROFILE_UPDATED',
      version: 2,
      payload: { ...basePayload, displayName: 'Duplicate', version: 2 },
    });

    const doc = index.get('profile-1');
    expect(doc?.displayName).toBe('First');
  });

  it('should_delete_profile_on_PROFILE_DELETED', async () => {
    await consumer.handleMessage({
      aggregateId: 'profile-1',
      type: 'PROFILE_CREATED',
      version: 1,
      payload: { ...basePayload, version: 1 },
    });

    await consumer.handleMessage({
      aggregateId: 'profile-1',
      type: 'PROFILE_DELETED',
      version: 2,
      payload: { ...basePayload, status: 'INACTIVE', version: 2 },
    });

    expect(index.get('profile-1')).toBeUndefined();
  });
});
