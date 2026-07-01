import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { Client } from '@opensearch-project/opensearch';
import { SystemClock, UuidIdGenerator } from './application/adapters/system-clock';
import { CreateProfileUseCase } from './application/use-cases/create-profile.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { DeleteProfileUseCase } from './application/use-cases/delete-profile.use-case';
import { GetProfileByIdUseCase } from './application/use-cases/get-profile-by-id.use-case';
import { SearchProfilesUseCase } from './application/use-cases/search-profiles.use-case';
import { Clock, IdGenerator } from './application/ports/application.port';
import {
  EventPublisher,
  OutboxRepository,
  ProfileSearchRepository,
  UserProfileRepository,
} from './domain/ports/repositories.port';
import { OutboxPollerService } from './infrastructure/messaging/outbox-poller.service';
import { ProfileIndexConsumer } from './infrastructure/messaging/profile-index.consumer';
import { SnsEventPublisher } from './infrastructure/messaging/sns-event.publisher';
import { SqsProfileIndexConsumerService } from './infrastructure/messaging/sqs-profile-index.consumer.service';
import {
  PrismaOutboxRepository,
  PrismaUserProfileRepository,
} from './infrastructure/persistence/prisma-user-profile.repository';
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { OpenSearchProfileRepository } from './infrastructure/search/opensearch-profile.repository';
import { OpenSearchBootstrapService } from './infrastructure/search/opensearch-bootstrap.service';
import { ProfileResolver } from './presentation/graphql/profile.resolver';
import {
  CLOCK,
  EVENT_PUBLISHER,
  ID_GENERATOR,
  OUTBOX_REPOSITORY,
  PROFILE_SEARCH_REPOSITORY,
  USER_PROFILE_REPOSITORY,
} from './profile.tokens';

export {
  CLOCK,
  EVENT_PUBLISHER,
  ID_GENERATOR,
  OUTBOX_REPOSITORY,
  PROFILE_SEARCH_REPOSITORY,
  USER_PROFILE_REPOSITORY,
} from './profile.tokens';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    PrismaService,
    ProfileResolver,
    OutboxPollerService,
    ProfileIndexConsumer,
    SqsProfileIndexConsumerService,
    OpenSearchBootstrapService,
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
    {
      provide: ID_GENERATOR,
      useClass: UuidIdGenerator,
    },
    {
      provide: USER_PROFILE_REPOSITORY,
      useClass: PrismaUserProfileRepository,
    },
    {
      provide: PROFILE_SEARCH_REPOSITORY,
      useFactory: () => {
        const node = process.env.OPENSEARCH_NODE ?? 'http://localhost:9200';
        const client = new Client({ node });
        return new OpenSearchProfileRepository(client);
      },
    },
    {
      provide: OUTBOX_REPOSITORY,
      useClass: PrismaOutboxRepository,
    },
    {
      provide: EVENT_PUBLISHER,
      useClass: SnsEventPublisher,
    },
    {
      provide: CreateProfileUseCase,
      useFactory: (
        repo: UserProfileRepository,
        clock: Clock,
        idGen: IdGenerator,
      ) => new CreateProfileUseCase(repo, clock, idGen),
      inject: [USER_PROFILE_REPOSITORY, CLOCK, ID_GENERATOR],
    },
    {
      provide: UpdateProfileUseCase,
      useFactory: (repo: UserProfileRepository, clock: Clock) =>
        new UpdateProfileUseCase(repo, clock),
      inject: [USER_PROFILE_REPOSITORY, CLOCK],
    },
    {
      provide: DeleteProfileUseCase,
      useFactory: (repo: UserProfileRepository, clock: Clock) =>
        new DeleteProfileUseCase(repo, clock),
      inject: [USER_PROFILE_REPOSITORY, CLOCK],
    },
    {
      provide: GetProfileByIdUseCase,
      useFactory: (repo: UserProfileRepository) =>
        new GetProfileByIdUseCase(repo),
      inject: [USER_PROFILE_REPOSITORY],
    },
    {
      provide: SearchProfilesUseCase,
      useFactory: (repo: ProfileSearchRepository) =>
        new SearchProfilesUseCase(repo),
      inject: [PROFILE_SEARCH_REPOSITORY],
    },
  ],
  exports: [
    CreateProfileUseCase,
    UpdateProfileUseCase,
    DeleteProfileUseCase,
    GetProfileByIdUseCase,
    SearchProfilesUseCase,
    ProfileIndexConsumer,
    SqsProfileIndexConsumerService,
  ],
})
export class ProfileModule {}

export type ProfileModuleOverrides = {
  userProfileRepository?: UserProfileRepository;
  profileSearchRepository?: ProfileSearchRepository;
  outboxRepository?: OutboxRepository;
  eventPublisher?: EventPublisher;
  clock?: Clock;
  idGenerator?: IdGenerator;
};

export function createProfileModuleProviders(
  overrides: ProfileModuleOverrides = {},
) {
  const clock = overrides.clock ?? new SystemClock();
  const idGenerator = overrides.idGenerator ?? new UuidIdGenerator();
  const userProfileRepository =
    overrides.userProfileRepository ?? new PrismaUserProfileRepository(new PrismaService());
  const profileSearchRepository =
    overrides.profileSearchRepository ??
    new OpenSearchProfileRepository(new Client({ node: 'http://localhost:9200' }));
  const outboxRepository =
    overrides.outboxRepository ?? new PrismaOutboxRepository(new PrismaService());
  const eventPublisher = overrides.eventPublisher ?? new SnsEventPublisher();

  return {
    clock,
    idGenerator,
    userProfileRepository,
    profileSearchRepository,
    outboxRepository,
    eventPublisher,
    createProfileUseCase: new CreateProfileUseCase(
      userProfileRepository,
      clock,
      idGenerator,
    ),
    updateProfileUseCase: new UpdateProfileUseCase(userProfileRepository, clock),
    deleteProfileUseCase: new DeleteProfileUseCase(userProfileRepository, clock),
    getProfileByIdUseCase: new GetProfileByIdUseCase(userProfileRepository),
    searchProfilesUseCase: new SearchProfilesUseCase(profileSearchRepository),
    profileIndexConsumer: new ProfileIndexConsumer(profileSearchRepository),
  };
}
