import { GetProfileByIdUseCase } from '../../../src/application/use-cases/get-profile-by-id.use-case';
import { ProfileNotFoundError } from '../../../src/domain/errors/domain.errors';
import {
  buildProfile,
  InMemoryUserProfileRepository,
} from '../../support/in-memory-repositories';

describe('GetProfileByIdUseCase', () => {
  let repository: InMemoryUserProfileRepository;
  let useCase: GetProfileByIdUseCase;

  beforeEach(() => {
    repository = new InMemoryUserProfileRepository();
    useCase = new GetProfileByIdUseCase(repository);
  });

  it('should_return_profile_when_found', async () => {
    repository.seed(buildProfile({ id: 'p1' }));
    const profile = await useCase.execute('p1');
    expect(profile.id).toBe('p1');
  });

  it('should_throw_when_not_found', async () => {
    await expect(useCase.execute('missing')).rejects.toThrow(
      ProfileNotFoundError,
    );
  });
});
