import { CreateProfileUseCase } from '../../../src/application/use-cases/create-profile.use-case';
import {
  EmailAlreadyTakenError,
  UsernameAlreadyTakenError,
} from '../../../src/domain/errors/domain.errors';
import { FakeClock } from '../../support/fake-clock';
import { FakeIdGenerator } from '../../support/fake-id-generator';
import {
  buildProfile,
  InMemoryUserProfileRepository,
} from '../../support/in-memory-repositories';

describe('CreateProfileUseCase', () => {
  const clock = new FakeClock();
  const idGenerator = new FakeIdGenerator(['new-profile-id']);
  let repository: InMemoryUserProfileRepository;
  let useCase: CreateProfileUseCase;

  beforeEach(() => {
    repository = new InMemoryUserProfileRepository();
    useCase = new CreateProfileUseCase(repository, clock, idGenerator);
  });

  it('should_create_profile_and_persist_outbox_event', async () => {
    const profile = await useCase.execute({
      username: 'newuser',
      email: 'new@example.com',
      displayName: 'New User',
    });

    expect(profile.id).toBe('new-profile-id');
    expect(profile.username.toString()).toBe('newuser');
    const outbox = repository.getOutboxEvents();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].type).toBe('PROFILE_CREATED');
    expect(outbox[0].aggregateId).toBe('new-profile-id');
  });

  it('should_throw_when_username_already_taken', async () => {
    repository.seed(buildProfile({ username: 'taken' }));

    await expect(
      useCase.execute({
        username: 'taken',
        email: 'other@example.com',
        displayName: 'Other',
      }),
    ).rejects.toThrow(UsernameAlreadyTakenError);
  });

  it('should_throw_when_email_already_taken', async () => {
    repository.seed(buildProfile({ email: 'taken@example.com' }));

    await expect(
      useCase.execute({
        username: 'otheruser',
        email: 'taken@example.com',
        displayName: 'Other',
      }),
    ).rejects.toThrow(EmailAlreadyTakenError);
  });
});
