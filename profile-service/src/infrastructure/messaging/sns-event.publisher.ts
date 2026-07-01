import { Injectable } from '@nestjs/common';
import {
  PublishCommand,
  SNSClient,
} from '@aws-sdk/client-sns';
import {
  EventPublisher,
  OutboxEventRecord,
} from '../../domain/ports/repositories.port';
import { buildAwsClientConfig } from './aws-client.config';

@Injectable()
export class SnsEventPublisher implements EventPublisher {
  private readonly client: SNSClient;
  private readonly topicArn: string;

  constructor() {
    this.client = new SNSClient(buildAwsClientConfig());
    this.topicArn = process.env.SNS_TOPIC_ARN ?? '';
  }

  async publish(event: OutboxEventRecord): Promise<void> {
    const deduplicationId = `${event.aggregateId}:${event.version}:${event.type}`;
    await this.client.send(
      new PublishCommand({
        TopicArn: this.topicArn,
        Message: JSON.stringify({
          aggregateId: event.aggregateId,
          type: event.type,
          version: event.version,
          payload: event.payload,
        }),
        MessageGroupId: event.aggregateId,
        MessageDeduplicationId: deduplicationId,
      }),
    );
  }
}

export class InMemoryEventPublisher implements EventPublisher {
  published: OutboxEventRecord[] = [];

  async publish(event: OutboxEventRecord): Promise<void> {
    this.published.push(event);
  }
}
