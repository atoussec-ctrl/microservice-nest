import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import request from 'supertest';
import { ProfileResolver } from '../../src/presentation/graphql/profile.resolver';
import { CreateProfileUseCase } from '../../src/application/use-cases/create-profile.use-case';
import { UpdateProfileUseCase } from '../../src/application/use-cases/update-profile.use-case';
import { DeleteProfileUseCase } from '../../src/application/use-cases/delete-profile.use-case';
import { GetProfileByIdUseCase } from '../../src/application/use-cases/get-profile-by-id.use-case';
import { SearchProfilesUseCase } from '../../src/application/use-cases/search-profiles.use-case';
import { ProfileIndexConsumer } from '../../src/infrastructure/messaging/profile-index.consumer';
import { FakeClock } from '../support/fake-clock';
import { FakeIdGenerator } from '../support/fake-id-generator';
import {
  InMemoryOpenSearchIndex,
  InMemoryProfileSearchRepository,
} from '../../src/infrastructure/search/opensearch-profile.repository';
import { InMemoryUserProfileRepository } from '../support/in-memory-repositories';

describe('Profile GraphQL (e2e)', () => {
  let app: INestApplication;
  let profileRepo: InMemoryUserProfileRepository;
  let searchIndex: InMemoryOpenSearchIndex;
  let consumer: ProfileIndexConsumer;
  const clock = new FakeClock(new Date('2024-06-01T00:00:00.000Z'));
  const idGenerator = new FakeIdGenerator(['e2e-profile-1', 'e2e-profile-2']);

  beforeAll(async () => {
    profileRepo = new InMemoryUserProfileRepository();
    searchIndex = new InMemoryOpenSearchIndex();
    const searchRepo = new InMemoryProfileSearchRepository(searchIndex);
    consumer = new ProfileIndexConsumer(searchRepo);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
        }),
      ],
      providers: [
        ProfileResolver,
        {
          provide: CreateProfileUseCase,
          useValue: new CreateProfileUseCase(profileRepo, clock, idGenerator),
        },
        {
          provide: UpdateProfileUseCase,
          useValue: new UpdateProfileUseCase(profileRepo, clock),
        },
        {
          provide: DeleteProfileUseCase,
          useValue: new DeleteProfileUseCase(profileRepo, clock),
        },
        {
          provide: GetProfileByIdUseCase,
          useValue: new GetProfileByIdUseCase(profileRepo),
        },
        {
          provide: SearchProfilesUseCase,
          useValue: new SearchProfilesUseCase(searchRepo),
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should_create_and_fetch_profile_via_graphql', async () => {
    const createMutation = `
      mutation {
        createProfile(input: {
          username: "e2euser"
          email: "e2e@example.com"
          displayName: "E2E User"
        }) {
          id
          username
          email
          displayName
          version
        }
      }
    `;

    const createRes = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: createMutation })
      .expect(200);

    expect(createRes.body.data.createProfile.username).toBe('e2euser');
    expect(createRes.body.data.createProfile.id).toBe('e2e-profile-1');

    const query = `
      query {
        profile(id: "e2e-profile-1") {
          username
          displayName
        }
      }
    `;

    const getRes = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query })
      .expect(200);

    expect(getRes.body.data.profile.displayName).toBe('E2E User');
  });

  it('should_search_profiles_after_indexing', async () => {
    const outbox = profileRepo.getOutboxEvents();
    const createdEvent = outbox.find((e) => e.type === 'PROFILE_CREATED');
    expect(createdEvent).toBeDefined();

    await consumer.handleMessage({
      aggregateId: createdEvent!.aggregateId,
      type: createdEvent!.type,
      version: createdEvent!.version,
      payload: createdEvent!.payload,
    });

    const searchQuery = `
      query {
        searchProfiles(query: "E2E") {
          total
          items { username displayName }
        }
      }
    `;

    const searchRes = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: searchQuery })
      .expect(200);

    expect(searchRes.body.data.searchProfiles.total).toBeGreaterThanOrEqual(1);
    expect(searchRes.body.data.searchProfiles.items[0].username).toBe('e2euser');
  });
});
