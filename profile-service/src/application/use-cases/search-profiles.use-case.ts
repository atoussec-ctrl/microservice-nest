import {
  ProfileSearchRepository,
  ProfileSearchResult,
} from '../../domain/ports/repositories.port';

export interface SearchProfilesInput {
  query?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export class SearchProfilesUseCase {
  constructor(private readonly searchRepository: ProfileSearchRepository) {}

  async execute(input: SearchProfilesInput): Promise<ProfileSearchResult> {
    return this.searchRepository.search({
      query: input.query,
      status: input.status,
      limit: input.limit ?? 20,
      offset: input.offset ?? 0,
    });
  }
}
