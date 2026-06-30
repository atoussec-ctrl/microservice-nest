import { ProfileStatus } from '../../domain/enums/profile.enums';
import {
  ProfileNotFoundError,
  VersionConflictError,
} from '../../domain/errors/domain.errors';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserProfileRepository } from '../../domain/ports/repositories.port';
import { Clock } from '../ports/application.port';
import { DisplayName } from '../../domain/value-objects/display-name.vo';

export interface UpdateProfileInput {
  id: string;
  version: number;
  displayName?: string;
  avatarUrl?: string | null;
  status?: ProfileStatus;
}

export class UpdateProfileUseCase {
  constructor(
    private readonly repository: UserProfileRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateProfileInput): Promise<UserProfile> {
    const profile = await this.repository.findById(input.id);
    if (!profile) {
      throw new ProfileNotFoundError(input.id);
    }

    try {
      profile.update({
        expectedVersion: input.version,
        displayName:
          input.displayName !== undefined
            ? DisplayName.create(input.displayName)
            : undefined,
        avatarUrl: input.avatarUrl,
        status: input.status,
        now: this.clock.now(),
      });
    } catch (error) {
      if (error instanceof VersionConflictError) {
        throw error;
      }
      throw error;
    }

    const events = profile.pullDomainEvents();
    await this.repository.save(profile, events);
    return profile;
  }
}
