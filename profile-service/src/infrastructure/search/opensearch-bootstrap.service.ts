import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OpenSearchProfileRepository } from './opensearch-profile.repository';
import { PROFILE_SEARCH_REPOSITORY } from '../../profile.tokens';
import { ProfileSearchRepository } from '../../domain/ports/repositories.port';

@Injectable()
export class OpenSearchBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(OpenSearchBootstrapService.name);

  constructor(
    @Inject(PROFILE_SEARCH_REPOSITORY)
    private readonly searchRepository: ProfileSearchRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!(this.searchRepository instanceof OpenSearchProfileRepository)) {
      return;
    }

    try {
      await this.searchRepository.ensureIndex();
      this.logger.log('OpenSearch index ready');
    } catch (error) {
      this.logger.error('Failed to bootstrap OpenSearch index', error as Error);
    }
  }
}
