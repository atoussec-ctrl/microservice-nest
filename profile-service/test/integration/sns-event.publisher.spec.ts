const sendMock = jest.fn();

jest.mock('@aws-sdk/client-sns', () => {
  class PublishCommand {
    constructor(public readonly input: Record<string, unknown>) {}
  }
  class SNSClient {
    send = sendMock;
  }
  return { PublishCommand, SNSClient };
});

import {
  InMemoryEventPublisher,
  SnsEventPublisher,
} from '../../src/infrastructure/messaging/sns-event.publisher';
import { OutboxEventRecord } from '../../src/domain/ports/repositories.port';

const event: OutboxEventRecord = {
  id: 'e1',
  aggregateId: 'agg-1',
  type: 'PROFILE_UPDATED',
  payload: { id: 'agg-1', version: 2 },
  version: 2,
  status: 'PENDING',
  createdAt: new Date(),
  publishedAt: null,
};

describe('SnsEventPublisher', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
    process.env.SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:000000000000:t.fifo';
  });

  it('should_publish_with_fifo_group_and_dedupe_ids', async () => {
    const publisher = new SnsEventPublisher();
    await publisher.publish(event);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input.MessageGroupId).toBe('agg-1');
    expect(command.input.MessageDeduplicationId).toBe(
      'agg-1:2:PROFILE_UPDATED',
    );
    expect(JSON.parse(command.input.Message).version).toBe(2);
  });

  it('should_honor_custom_aws_endpoint', async () => {
    process.env.AWS_ENDPOINT = 'http://localhost:4566';
    const publisher = new SnsEventPublisher();
    await publisher.publish(event);
    expect(sendMock).toHaveBeenCalled();
    delete process.env.AWS_ENDPOINT;
  });

  it('should_default_topic_arn_to_empty_string_when_env_unset', async () => {
    delete process.env.SNS_TOPIC_ARN;
    const publisher = new SnsEventPublisher();
    await publisher.publish(event);
    const command = sendMock.mock.calls[0][0];
    expect(command.input.TopicArn).toBe('');
  });
});

describe('InMemoryEventPublisher', () => {
  it('should_collect_published_events', async () => {
    const publisher = new InMemoryEventPublisher();
    await publisher.publish(event);
    expect(publisher.published).toEqual([event]);
  });
});
