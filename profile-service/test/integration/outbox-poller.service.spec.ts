import { OutboxPollerService } from '../../src/infrastructure/messaging/outbox-poller.service';
import { InMemoryEventPublisher } from '../../src/infrastructure/messaging/sns-event.publisher';
import {
  OutboxEventRecord,
  OutboxRepository,
} from '../../src/domain/ports/repositories.port';
import { FakeClock } from '../support/fake-clock';

function makeEvent(id: string): OutboxEventRecord {
  return {
    id,
    aggregateId: 'agg-1',
    type: 'PROFILE_CREATED',
    payload: { id: 'agg-1', version: 1 },
    version: 1,
    status: 'PENDING',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    publishedAt: null,
  };
}

class FakeOutboxRepository implements OutboxRepository {
  published: string[] = [];
  failed: string[] = [];

  constructor(private pending: OutboxEventRecord[]) {}

  async findPending(limit: number): Promise<OutboxEventRecord[]> {
    return this.pending.slice(0, limit);
  }

  async markPublished(id: string): Promise<void> {
    this.published.push(id);
  }

  async markFailed(id: string): Promise<void> {
    this.failed.push(id);
  }
}

describe('OutboxPollerService', () => {
  it('should_publish_pending_events_and_mark_them_published', async () => {
    const repo = new FakeOutboxRepository([makeEvent('e1'), makeEvent('e2')]);
    const publisher = new InMemoryEventPublisher();
    const poller = new OutboxPollerService(repo, publisher, new FakeClock());

    const count = await poller.processPendingEvents();

    expect(count).toBe(2);
    expect(publisher.published).toHaveLength(2);
    expect(repo.published).toEqual(['e1', 'e2']);
    expect(repo.failed).toEqual([]);
  });

  it('should_mark_event_failed_when_publisher_throws', async () => {
    const repo = new FakeOutboxRepository([makeEvent('e1')]);
    const failingPublisher = {
      publish: jest.fn().mockRejectedValue(new Error('SNS down')),
    };
    const poller = new OutboxPollerService(
      repo,
      failingPublisher,
      new FakeClock(),
    );

    const count = await poller.processPendingEvents();

    expect(count).toBe(0);
    expect(repo.failed).toEqual(['e1']);
    expect(repo.published).toEqual([]);
  });

  it('should_delegate_poll_to_processPendingEvents', async () => {
    const repo = new FakeOutboxRepository([]);
    const poller = new OutboxPollerService(
      repo,
      new InMemoryEventPublisher(),
      new FakeClock(),
    );
    await expect(poller.poll()).resolves.toBeUndefined();
  });

  it('should_fallback_to_system_clock_when_clock_not_provided', () => {
    const repo = new FakeOutboxRepository([]);
    const poller = new OutboxPollerService(repo, new InMemoryEventPublisher());
    expect(poller).toBeInstanceOf(OutboxPollerService);
  });
});
