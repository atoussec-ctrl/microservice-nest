import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import {
  ProfileIndexConsumer,
  ProfileIndexMessage,
} from './profile-index.consumer';

export const SQS_CLIENT = 'SqsClient';
export const SQS_QUEUE_URL = 'SqsQueueUrl';

@Injectable()
export class SqsProfileIndexConsumerService {
  private readonly logger = new Logger(SqsProfileIndexConsumerService.name);
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor(
    private readonly consumer: ProfileIndexConsumer,
    @Optional() @Inject(SQS_CLIENT) client?: SQSClient,
    @Optional() @Inject(SQS_QUEUE_URL) queueUrl?: string,
  ) {
    const endpoint = process.env.AWS_ENDPOINT;
    this.client =
      client ??
      new SQSClient({
        region: process.env.AWS_REGION ?? 'us-east-1',
        ...(endpoint ? { endpoint } : {}),
      });
    this.queueUrl = queueUrl ?? process.env.SQS_QUEUE_URL ?? '';
  }

  async pollOnce(): Promise<number> {
    const response = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 5,
      }),
    );

    const messages = response.Messages ?? [];
    let processed = 0;

    for (const message of messages) {
      if (await this.handleSingle(message)) {
        processed += 1;
      }
    }

    return processed;
  }

  private async handleSingle(message: Message): Promise<boolean> {
    try {
      const payload = this.parseMessage(message.Body);
      await this.consumer.handleMessage(payload);
      await this.deleteMessage(message.ReceiptHandle);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to process SQS message ${message.MessageId}`,
        error as Error,
      );
      return false;
    }
  }

  private parseMessage(body: string | undefined): ProfileIndexMessage {
    if (!body) {
      throw new Error('Empty SQS message body');
    }
    const parsed = JSON.parse(body);
    const inner =
      typeof parsed.Message === 'string' ? JSON.parse(parsed.Message) : parsed;

    if (!inner.aggregateId || !inner.type || inner.version === undefined) {
      throw new Error('Malformed profile index message');
    }

    return inner as ProfileIndexMessage;
  }

  private async deleteMessage(receiptHandle: string | undefined): Promise<void> {
    if (!receiptHandle) {
      return;
    }
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
  }
}
