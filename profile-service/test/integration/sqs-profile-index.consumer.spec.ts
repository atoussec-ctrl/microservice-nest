jest.mock('@aws-sdk/client-sqs', () => {
  class ReceiveMessageCommand {
    constructor(public readonly input: Record<string, unknown>) {}
  }
  class DeleteMessageCommand {
    constructor(public readonly input: Record<string, unknown>) {}
  }
  class SQSClient {
    send = jest.fn();
  }
  return { ReceiveMessageCommand, DeleteMessageCommand, SQSClient };
});

import { SQSClient } from '@aws-sdk/client-sqs';
import { SqsProfileIndexConsumerService } from '../../src/infrastructure/messaging/sqs-profile-index.consumer.service';
import { ProfileIndexConsumer } from '../../src/infrastructure/messaging/profile-index.consumer';
import {
  InMemoryOpenSearchIndex,
  InMemoryProfileSearchRepository,
} from '../../src/infrastructure/search/opensearch-profile.repository';

function snsWrappedBody(version: number): string {
  return JSON.stringify({
    Message: JSON.stringify({
      aggregateId: 'p1',
      type: 'PROFILE_CREATED',
      version,
      payload: {
        id: 'p1',
        username: 'alice',
        email: 'alice@example.com',
        displayName: 'Alice',
        avatarUrl: null,
        status: 'ACTIVE',
        version,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    }),
  });
}

describe('SqsProfileIndexConsumerService', () => {
  let index: InMemoryOpenSearchIndex;
  let consumer: ProfileIndexConsumer;
  let client: SQSClient;
  let service: SqsProfileIndexConsumerService;

  beforeEach(() => {
    index = new InMemoryOpenSearchIndex();
    consumer = new ProfileIndexConsumer(
      new InMemoryProfileSearchRepository(index),
    );
    client = new SQSClient({});
    service = new SqsProfileIndexConsumerService(
      consumer,
      client,
      'http://localhost/queue',
    );
  });

  it('should_process_sns_wrapped_message_and_delete_it', async () => {
    (client.send as jest.Mock)
      .mockResolvedValueOnce({
        Messages: [
          { MessageId: 'm1', ReceiptHandle: 'rh1', Body: snsWrappedBody(1) },
        ],
      })
      .mockResolvedValueOnce({});

    const processed = await service.pollOnce();

    expect(processed).toBe(1);
    expect(index.get('p1')?.version).toBe(1);
    expect(client.send).toHaveBeenCalledTimes(2);
  });

  it('should_return_zero_when_no_messages', async () => {
    (client.send as jest.Mock).mockResolvedValueOnce({});
    expect(await service.pollOnce()).toBe(0);
  });

  it('should_not_delete_malformed_message', async () => {
    (client.send as jest.Mock).mockResolvedValueOnce({
      Messages: [{ MessageId: 'm2', ReceiptHandle: 'rh2', Body: '{"foo":1}' }],
    });

    const processed = await service.pollOnce();

    expect(processed).toBe(0);
    expect(client.send).toHaveBeenCalledTimes(1);
  });

  it('should_handle_empty_body_gracefully', async () => {
    (client.send as jest.Mock).mockResolvedValueOnce({
      Messages: [{ MessageId: 'm3', ReceiptHandle: 'rh3', Body: undefined }],
    });
    expect(await service.pollOnce()).toBe(0);
  });

  it('should_process_direct_unwrapped_message', async () => {
    const direct = JSON.stringify({
      aggregateId: 'p2',
      type: 'PROFILE_CREATED',
      version: 1,
      payload: {
        id: 'p2',
        username: 'bob',
        email: 'bob@example.com',
        displayName: 'Bob',
        avatarUrl: null,
        status: 'ACTIVE',
        version: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    });
    (client.send as jest.Mock)
      .mockResolvedValueOnce({
        Messages: [{ MessageId: 'm4', ReceiptHandle: 'rh4', Body: direct }],
      })
      .mockResolvedValueOnce({});

    expect(await service.pollOnce()).toBe(1);
    expect(index.get('p2')?.username).toBe('bob');
  });

  it('should_construct_with_env_defaults_when_no_client_provided', () => {
    const svc = new SqsProfileIndexConsumerService(consumer);
    expect(svc).toBeInstanceOf(SqsProfileIndexConsumerService);
  });
});
