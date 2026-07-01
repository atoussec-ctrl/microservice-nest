import { ProfileNotFoundError } from '../../domain/errors/domain.errors';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserProfileRepository } from '../../domain/ports/repositories.port';

export class GetProfileByIdUseCase {
  constructor(private readonly repository: UserProfileRepository) {}

  async execute(id: string): Promise<UserProfile> {
    const profile = await this.repository.findById(id);
    if (!profile || profile.isDeleted()) {
      throw new ProfileNotFoundError(id);
    }
    return profile;
  }
}
