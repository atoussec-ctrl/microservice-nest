import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProfileSearchRepository } from '../../domain/ports/repositories.port';
import { PROFILE_SEARCH_REPOSITORY } from '../../profile.tokens';

export interface ProfileIndexMessage {
  aggregateId: string;
  type: string;
  version: number;
  payload: Record<string, unknown>;
}

@Injectable()
export class ProfileIndexConsumer {
  private readonly logger = new Logger(ProfileIndexConsumer.name);

  constructor(
    @Inject(PROFILE_SEARCH_REPOSITORY)
    private readonly searchRepository: ProfileSearchRepository,
  ) {}

  async handleMessage(message: ProfileIndexMessage): Promise<void> {
    const { aggregateId, type, version, payload } = message;

    switch (type) {
      case 'PROFILE_CREATED':
      case 'PROFILE_UPDATED':
        await this.searchRepository.upsertVersionAware(
          aggregateId,
          version,
          payload,
        );
        break;
      case 'PROFILE_DELETED':
        await this.searchRepository.delete(aggregateId);
        break;
      default:
        this.logger.warn(`Unknown event type: ${type}`);
    }
  }
}
