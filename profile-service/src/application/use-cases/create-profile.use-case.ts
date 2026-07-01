import { Clock, IdGenerator, TokenIssuer } from '../ports/application.port';
import {
  EmailAlreadyTakenError,
  UsernameAlreadyTakenError,
} from '../../domain/errors/domain.errors';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserProfileRepository } from '../../domain/ports/repositories.port';
import { DisplayName } from '../../domain/value-objects/display-name.vo';
import { Email } from '../../domain/value-objects/email.vo';
import { Username } from '../../domain/value-objects/username.vo';

export interface CreateProfileInput {
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface CreateProfileResult {
  profile: UserProfile;
  accessToken: string;
}

export class CreateProfileUseCase {
  constructor(
    private readonly repository: UserProfileRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute(input: CreateProfileInput): Promise<CreateProfileResult> {
    const username = Username.create(input.username);
    const email = Email.create(input.email);
    const displayName = DisplayName.create(input.displayName);

    if (await this.repository.existsByUsername(username.toString())) {
      throw new UsernameAlreadyTakenError(username.toString());
    }
    if (await this.repository.existsByEmail(email.toString())) {
      throw new EmailAlreadyTakenError(email.toString());
    }

    const now = this.clock.now();
    const profile = UserProfile.create({
      id: this.idGenerator.generate(),
      username,
      email,
      displayName,
      avatarUrl: input.avatarUrl,
      now,
    });

    const events = profile.pullDomainEvents();
    await this.repository.save(profile, events);

    return { profile, accessToken: this.tokenIssuer.issueFor(profile.id) };
  }
}
