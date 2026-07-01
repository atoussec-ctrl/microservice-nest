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

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class SearchProfilesUseCase {
  constructor(private readonly searchRepository: ProfileSearchRepository) {}

  async execute(input: SearchProfilesInput): Promise<ProfileSearchResult> {
    const limit = Math.min(
      Math.max(input.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(input.offset ?? 0, 0);

    return this.searchRepository.search({
      query: input.query,
      status: input.status,
      limit,
      offset,
    });
  }
}
