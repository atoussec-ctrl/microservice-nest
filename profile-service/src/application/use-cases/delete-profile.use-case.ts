import { ProfileNotFoundError } from '../../domain/errors/domain.errors';
import { UserProfileRepository } from '../../domain/ports/repositories.port';
import { Clock } from '../ports/application.port';

export class DeleteProfileUseCase {
  constructor(
    private readonly repository: UserProfileRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<boolean> {
    const profile = await this.repository.findById(id);
    if (!profile) {
      throw new ProfileNotFoundError(id);
    }

    profile.delete(this.clock.now());
    const events = profile.pullDomainEvents();
    await this.repository.save(profile, events);
    return true;
  }
}
