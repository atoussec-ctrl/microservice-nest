import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLFormattedError } from 'graphql';
import request from 'supertest';
import { ProfileResolver } from '../../src/presentation/graphql/profile.resolver';
import { DomainExceptionFilter } from '../../src/presentation/graphql/domain-exception.filter';
import { CreateProfileUseCase } from '../../src/application/use-cases/create-profile.use-case';
import { UpdateProfileUseCase } from '../../src/application/use-cases/update-profile.use-case';
import { DeleteProfileUseCase } from '../../src/application/use-cases/delete-profile.use-case';
import { GetProfileByIdUseCase } from '../../src/application/use-cases/get-profile-by-id.use-case';
import { SearchProfilesUseCase } from '../../src/application/use-cases/search-profiles.use-case';
import { FakeClock } from '../support/fake-clock';
import { FakeIdGenerator } from '../support/fake-id-generator';
import { InMemoryUserProfileRepository } from '../support/in-memory-repositories';
import {
  InMemoryOpenSearchIndex,
  InMemoryProfileSearchRepository,
} from '../../src/infrastructure/search/opensearch-profile.repository';

describe('Profile GraphQL error handling (e2e)', () => {
  let app: INestApplication;
  let repo: InMemoryUserProfileRepository;
  const clock = new FakeClock(new Date('2024-06-01T00:00:00.000Z'));

  async function post(query: string) {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query })
      .expect(200);
    return res.body;
  }

  function firstErrorCode(body: {
    errors?: GraphQLFormattedError[];
  }): string | undefined {
    return body.errors?.[0]?.extensions?.code as string | undefined;
  }

  beforeAll(async () => {
    repo = new InMemoryUserProfileRepository();
    const searchRepo = new InMemoryProfileSearchRepository(
      new InMemoryOpenSearchIndex(),
    );
    const idGenerator = new FakeIdGenerator(['p1', 'p2', 'p3']);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          formatError: (e: GraphQLFormattedError) => ({
            message: e.message,
            path: e.path,
            extensions: {
              code: e.extensions?.code ?? 'INTERNAL_SERVER_ERROR',
              domainCode: e.extensions?.domainCode,
            },
          }),
        }),
      ],
      providers: [
        ProfileResolver,
        { provide: APP_FILTER, useClass: DomainExceptionFilter },
        {
          provide: CreateProfileUseCase,
          useValue: new CreateProfileUseCase(repo, clock, idGenerator),
        },
        {
          provide: UpdateProfileUseCase,
          useValue: new UpdateProfileUseCase(repo, clock),
        },
        {
          provide: DeleteProfileUseCase,
          useValue: new DeleteProfileUseCase(repo, clock),
        },
        {
          provide: GetProfileByIdUseCase,
          useValue: new GetProfileByIdUseCase(repo),
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

  it('should_create_first_profile_successfully', async () => {
    const body = await post(`
      mutation {
        createProfile(input: {
          username: "alice"
          email: "alice@example.com"
          displayName: "Alice"
        }) { id username }
      }
    `);
    expect(body.data.createProfile.username).toBe('alice');
  });

  it('should_return_CONFLICT_when_username_taken', async () => {
    const body = await post(`
      mutation {
        createProfile(input: {
          username: "alice"
          email: "another@example.com"
          displayName: "Other"
        }) { id }
      }
    `);
    expect(firstErrorCode(body)).toBe('CONFLICT');
  });

  it('should_return_BAD_USER_INPUT_when_username_invalid', async () => {
    const body = await post(`
      mutation {
        createProfile(input: {
          username: "a"
          email: "valid@example.com"
          displayName: "Valid"
        }) { id }
      }
    `);
    expect(firstErrorCode(body)).toBe('BAD_USER_INPUT');
  });

  it('should_return_NOT_FOUND_when_updating_missing_profile', async () => {
    const body = await post(`
      mutation {
        updateProfile(input: { id: "missing", version: 1, displayName: "X" }) { id }
      }
    `);
    expect(firstErrorCode(body)).toBe('NOT_FOUND');
  });

  it('should_return_PRECONDITION_FAILED_on_version_conflict', async () => {
    const body = await post(`
      mutation {
        updateProfile(input: { id: "p1", version: 99, displayName: "X" }) { id }
      }
    `);
    expect(firstErrorCode(body)).toBe('PRECONDITION_FAILED');
  });

  it('should_return_NOT_FOUND_when_deleting_missing_profile', async () => {
    const body = await post(`
      mutation { deleteProfile(id: "missing") }
    `);
    expect(firstErrorCode(body)).toBe('NOT_FOUND');
  });

  it('should_return_null_not_error_for_missing_profile_query', async () => {
    const body = await post(`query { profile(id: "missing") { id } }`);
    expect(body.errors).toBeUndefined();
    expect(body.data.profile).toBeNull();
  });
});
