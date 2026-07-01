import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { buildAwsClientConfig } from './aws-client.config';
import {
  ProfileIndexConsumer,
  ProfileIndexMessage,
} from './profile-index.consumer';

export const SQS_CLIENT = 'SqsClient';
export const SQS_QUEUE_URL = 'SqsQueueUrl';

@Injectable()
export class SqsProfileIndexConsumerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SqsProfileIndexConsumerService.name);
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private readonly pollingEnabled: boolean;
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly consumer: ProfileIndexConsumer,
    @Optional() @Inject(SQS_CLIENT) client?: SQSClient,
    @Optional() @Inject(SQS_QUEUE_URL) queueUrl?: string,
  ) {
    this.client = client ?? new SQSClient(buildAwsClientConfig());
    this.queueUrl = queueUrl ?? process.env.SQS_QUEUE_URL ?? '';
    this.pollingEnabled = process.env.SQS_POLLING_ENABLED !== 'false';
  }

  onApplicationBootstrap(): void {
    if (!this.pollingEnabled) {
      this.logger.warn('SQS polling disabled (SQS_POLLING_ENABLED=false).');
      return;
    }
    if (!this.queueUrl) {
      this.logger.error('SQS_QUEUE_URL is not set; consumer will not start.');
      return;
    }
    this.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop();
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.logger.log(`Starting SQS consumer on ${this.queueUrl}`);
    this.loopPromise = this.pollLoop();
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.logger.log('Stopping SQS consumer...');
    this.running = false;
    if (this.loopPromise) {
      await this.loopPromise;
      this.loopPromise = null;
    }
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.pollOnce();
      } catch (error) {
        this.logger.error('Polling cycle failed', error as Error);
        await this.delay(1000);
      }
    }
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
