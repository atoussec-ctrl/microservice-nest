import { DeleteProfileUseCase } from '../../../src/application/use-cases/delete-profile.use-case';
import { ProfileNotFoundError } from '../../../src/domain/errors/domain.errors';
import { FakeClock } from '../../support/fake-clock';
import {
  buildProfile,
  InMemoryUserProfileRepository,
} from '../../support/in-memory-repositories';

describe('DeleteProfileUseCase', () => {
  const clock = new FakeClock();
  let repository: InMemoryUserProfileRepository;
  let useCase: DeleteProfileUseCase;

  beforeEach(() => {
    repository = new InMemoryUserProfileRepository();
    useCase = new DeleteProfileUseCase(repository, clock);
  });

  it('should_delete_profile_and_emit_outbox_event', async () => {
    repository.seed(buildProfile({ id: 'p1' }));

    const result = await useCase.execute('p1');
    expect(result).toBe(true);
    const outbox = repository.getOutboxEvents();
    expect(outbox[0].type).toBe('PROFILE_DELETED');
  });

  it('should_throw_when_profile_not_found', async () => {
    await expect(useCase.execute('missing')).rejects.toThrow(
      ProfileNotFoundError,
    );
  });
});
