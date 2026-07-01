import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ProfileResolver } from '../../src/presentation/graphql/profile.resolver';
import { JwtAuthGuard } from '../../src/presentation/graphql/jwt-auth.guard';
import { DomainExceptionFilter } from '../../src/presentation/graphql/domain-exception.filter';
import { CreateProfileUseCase } from '../../src/application/use-cases/create-profile.use-case';
import { UpdateProfileUseCase } from '../../src/application/use-cases/update-profile.use-case';
import { DeleteProfileUseCase } from '../../src/application/use-cases/delete-profile.use-case';
import { GetProfileByIdUseCase } from '../../src/application/use-cases/get-profile-by-id.use-case';
import { SearchProfilesUseCase } from '../../src/application/use-cases/search-profiles.use-case';
import { ProfileIndexConsumer } from '../../src/infrastructure/messaging/profile-index.consumer';
import { JwtTokenIssuer } from '../../src/infrastructure/auth/jwt-token.issuer';
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
  const idGenerator = new FakeIdGenerator([
    'e2e-profile-1',
    'e2e-profile-2',
  ]);

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
        JwtModule.register({
          secret: 'e2e-test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        ProfileResolver,
        JwtAuthGuard,
        { provide: APP_FILTER, useClass: DomainExceptionFilter },
        {
          provide: CreateProfileUseCase,
          useFactory: (jwtService: JwtService) =>
            new CreateProfileUseCase(
              profileRepo,
              clock,
              idGenerator,
              new JwtTokenIssuer(jwtService),
            ),
          inject: [JwtService],
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

  it('should_create_profile_and_return_an_access_token', async () => {
    const createMutation = `
      mutation {
        createProfile(input: {
          username: "e2euser"
          email: "e2e@example.com"
          displayName: "E2E User"
        }) {
          profile { id username email displayName version }
          accessToken
        }
      }
    `;

    const createRes = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: createMutation })
      .expect(200);

    expect(createRes.body.data.createProfile.profile.username).toBe(
      'e2euser',
    );
    expect(createRes.body.data.createProfile.profile.id).toBe(
      'e2e-profile-1',
    );
    expect(typeof createRes.body.data.createProfile.accessToken).toBe(
      'string',
    );

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

  it('should_reject_update_without_a_bearer_token', async () => {
    const mutation = `
      mutation {
        updateProfile(input: { id: "e2e-profile-1", version: 1, displayName: "Hacked" }) {
          id
        }
      }
    `;

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: mutation })
      .expect(200);

    expect(res.body.errors).toBeDefined();
    expect(res.body.data).toBeNull();
  });

  it('should_reject_update_when_the_token_belongs_to_a_different_profile', async () => {
    const createOther = `
      mutation {
        createProfile(input: {
          username: "otheruser"
          email: "other@example.com"
          displayName: "Other User"
        }) {
          profile { id }
          accessToken
        }
      }
    `;

    const otherRes = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: createOther })
      .expect(200);
    const otherToken = otherRes.body.data.createProfile.accessToken as string;

    const mutation = `
      mutation {
        updateProfile(input: { id: "e2e-profile-1", version: 1, displayName: "Hacked" }) {
          id
        }
      }
    `;

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ query: mutation })
      .expect(200);

    expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
    expect(res.body.data).toBeNull();
  });

  it('should_update_profile_when_authenticated_as_its_owner', async () => {
    const loginQuery = `
      query { profile(id: "e2e-profile-1") { id } }
    `;
    await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: loginQuery })
      .expect(200);

    const ownerToken = new JwtService({
      secret: 'e2e-test-secret',
    }).sign({ sub: 'e2e-profile-1' });

    const mutation = `
      mutation {
        updateProfile(input: { id: "e2e-profile-1", version: 1, displayName: "Updated by owner" }) {
          id
          displayName
          version
        }
      }
    `;

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ query: mutation })
      .expect(200);

    expect(res.body.data.updateProfile.displayName).toBe('Updated by owner');
    expect(res.body.data.updateProfile.version).toBe(2);
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

    expect(searchRes.body.data.searchProfiles.total).toBeGreaterThanOrEqual(
      1,
    );
    expect(searchRes.body.data.searchProfiles.items[0].username).toBe(
      'e2euser',
    );
  });
});
