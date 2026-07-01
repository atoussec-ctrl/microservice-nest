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

  it('should_not_delete_message_when_receipt_handle_missing', async () => {
    const direct = JSON.stringify({
      aggregateId: 'p3',
      type: 'PROFILE_CREATED',
      version: 1,
      payload: {
        id: 'p3',
        username: 'carl',
        email: 'carl@example.com',
        displayName: 'Carl',
        avatarUrl: null,
        status: 'ACTIVE',
        version: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    });
    (client.send as jest.Mock).mockResolvedValueOnce({
      Messages: [{ MessageId: 'm5', ReceiptHandle: undefined, Body: direct }],
    });

    const processed = await service.pollOnce();

    expect(processed).toBe(1);
    expect(index.get('p3')?.username).toBe('carl');
    expect(client.send).toHaveBeenCalledTimes(1);
  });

  describe('onApplicationBootstrap', () => {
    afterEach(() => {
      delete process.env.SQS_POLLING_ENABLED;
      delete process.env.SQS_QUEUE_URL;
    });

    it('should_warn_and_not_start_when_polling_disabled', () => {
      process.env.SQS_POLLING_ENABLED = 'false';
      const svc = new SqsProfileIndexConsumerService(
        consumer,
        client,
        'http://localhost/queue',
      );

      svc.onApplicationBootstrap();

      expect((svc as unknown as { running: boolean }).running).toBe(false);
    });

    it('should_error_and_not_start_when_queue_url_missing', () => {
      delete process.env.SQS_QUEUE_URL;
      const svc = new SqsProfileIndexConsumerService(consumer, client, '');

      svc.onApplicationBootstrap();

      expect((svc as unknown as { running: boolean }).running).toBe(false);
    });

    it('should_start_polling_when_enabled_and_queue_url_set', async () => {
      (client.send as jest.Mock).mockResolvedValue({});
      const svc = new SqsProfileIndexConsumerService(
        consumer,
        client,
        'http://localhost/queue',
      );

      svc.onApplicationBootstrap();
      expect((svc as unknown as { running: boolean }).running).toBe(true);

      await svc.onApplicationShutdown();
      expect((svc as unknown as { running: boolean }).running).toBe(false);
    });
  });

  describe('start/stop lifecycle', () => {
    it('should_be_a_no_op_when_start_called_while_already_running', async () => {
      (client.send as jest.Mock).mockResolvedValue({});
      service.start();
      const firstLoopPromise = (
        service as unknown as { loopPromise: Promise<void> | null }
      ).loopPromise;

      service.start();

      expect(
        (service as unknown as { loopPromise: Promise<void> | null })
          .loopPromise,
      ).toBe(firstLoopPromise);
      await service.stop();
    });

    it('should_be_a_no_op_when_stop_called_while_not_running', async () => {
      await expect(service.stop()).resolves.toBeUndefined();
    });

    it('should_retry_after_delay_when_polling_cycle_throws', async () => {
      jest.useFakeTimers();
      (client.send as jest.Mock)
        .mockRejectedValueOnce(new Error('SQS down'))
        .mockImplementationOnce(async () => {
          (service as unknown as { running: boolean }).running = false;
          return {};
        });

      service.start();
      await Promise.resolve();
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(1000);

      expect((client.send as jest.Mock).mock.calls.length).toBe(2);
      jest.useRealTimers();
    });
  });
});
