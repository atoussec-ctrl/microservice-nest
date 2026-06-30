import { UpdateProfileUseCase } from '../../../src/application/use-cases/update-profile.use-case';
import {
  ProfileNotFoundError,
  VersionConflictError,
} from '../../../src/domain/errors/domain.errors';
import { ProfileStatus } from '../../../src/domain/enums/profile.enums';
import { FakeClock } from '../../support/fake-clock';
import {
  buildProfile,
  InMemoryUserProfileRepository,
} from '../../support/in-memory-repositories';

describe('UpdateProfileUseCase', () => {
  const clock = new FakeClock(new Date('2024-06-01T00:00:00.000Z'));
  let repository: InMemoryUserProfileRepository;
  let useCase: UpdateProfileUseCase;

  beforeEach(() => {
    repository = new InMemoryUserProfileRepository();
    useCase = new UpdateProfileUseCase(repository, clock);
  });

  it('should_update_profile_and_emit_outbox_event', async () => {
    repository.seed(buildProfile({ id: 'p1', version: 1 }));

    const updated = await useCase.execute({
      id: 'p1',
      version: 1,
      displayName: 'Updated Name',
      status: ProfileStatus.SUSPENDED,
    });

    expect(updated.version).toBe(2);
    expect(updated.displayName.toString()).toBe('Updated Name');
    expect(updated.status).toBe(ProfileStatus.SUSPENDED);
    const outbox = repository.getOutboxEvents();
    expect(outbox[0].type).toBe('PROFILE_UPDATED');
  });

  it('should_throw_when_profile_not_found', async () => {
    await expect(
      useCase.execute({ id: 'missing', version: 1, displayName: 'X' }),
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it('should_throw_when_version_conflict', async () => {
    repository.seed(buildProfile({ id: 'p1', version: 2 }));

    await expect(
      useCase.execute({ id: 'p1', version: 1, displayName: 'X' }),
    ).rejects.toThrow(VersionConflictError);
  });
});
