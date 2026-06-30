import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Clock } from '../../application/ports/application.port';
import {
  EventPublisher,
  OutboxRepository,
} from '../../domain/ports/repositories.port';
import { SystemClock } from '../../application/adapters/system-clock';
import { CLOCK, EVENT_PUBLISHER, OUTBOX_REPOSITORY } from '../../profile.tokens';

@Injectable()
export class OutboxPollerService {
  private readonly logger = new Logger(OutboxPollerService.name);
  private readonly clock: Clock;

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepository: OutboxRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
    @Inject(CLOCK) clock?: Clock,
  ) {
    this.clock = clock ?? new SystemClock();
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async poll(): Promise<void> {
    await this.processPendingEvents();
  }

  async processPendingEvents(): Promise<number> {
    const pending = await this.outboxRepository.findPending(50);
    let published = 0;

    for (const event of pending) {
      try {
        await this.eventPublisher.publish(event);
        await this.outboxRepository.markPublished(event.id, this.clock.now());
        published += 1;
      } catch (error) {
        this.logger.error(`Failed to publish outbox event ${event.id}`, error);
        await this.outboxRepository.markFailed(event.id);
      }
    }

    return published;
  }
}
