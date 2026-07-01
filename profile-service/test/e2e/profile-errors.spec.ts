import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { GraphQLFormattedError } from 'graphql';
import request from 'supertest';
import { ProfileResolver } from '../../src/presentation/graphql/profile.resolver';
import { JwtAuthGuard } from '../../src/presentation/graphql/jwt-auth.guard';
import { DomainExceptionFilter } from '../../src/presentation/graphql/domain-exception.filter';
import { CreateProfileUseCase } from '../../src/application/use-cases/create-profile.use-case';
import { UpdateProfileUseCase } from '../../src/application/use-cases/update-profile.use-case';
import { DeleteProfileUseCase } from '../../src/application/use-cases/delete-profile.use-case';
import { GetProfileByIdUseCase } from '../../src/application/use-cases/get-profile-by-id.use-case';
import { SearchProfilesUseCase } from '../../src/application/use-cases/search-profiles.use-case';
import { JwtTokenIssuer } from '../../src/infrastructure/auth/jwt-token.issuer';
import { FakeClock } from '../support/fake-clock';
import { FakeIdGenerator } from '../support/fake-id-generator';
import { InMemoryUserProfileRepository } from '../support/in-memory-repositories';
import {
  InMemoryOpenSearchIndex,
  InMemoryProfileSearchRepository,
} from '../../src/infrastructure/search/opensearch-profile.repository';

const JWT_SECRET = 'e2e-errors-secret';

describe('Profile GraphQL error handling (e2e)', () => {
  let app: INestApplication;
  let repo: InMemoryUserProfileRepository;
  const clock = new FakeClock(new Date('2024-06-01T00:00:00.000Z'));
  const jwtService = new JwtService({ secret: JWT_SECRET });

  function tokenFor(profileId: string): string {
    return jwtService.sign({ sub: profileId });
  }

  async function post(query: string, token?: string) {
    const req = request(app.getHttpServer()).post('/graphql');
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    const res = await req.send({ query }).expect(200);
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
        JwtModule.register({
          secret: JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        ProfileResolver,
        JwtAuthGuard,
        { provide: APP_FILTER, useClass: DomainExceptionFilter },
        {
          provide: CreateProfileUseCase,
          useFactory: (jwt: JwtService) =>
            new CreateProfileUseCase(
              repo,
              clock,
              idGenerator,
              new JwtTokenIssuer(jwt),
            ),
          inject: [JwtService],
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
        }) { profile { id username } accessToken }
      }
    `);
    expect(body.data.createProfile.profile.username).toBe('alice');
  });

  it('should_return_CONFLICT_when_username_taken', async () => {
    const body = await post(`
      mutation {
        createProfile(input: {
          username: "alice"
          email: "another@example.com"
          displayName: "Other"
        }) { profile { id } accessToken }
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
        }) { profile { id } accessToken }
      }
    `);
    expect(firstErrorCode(body)).toBe('BAD_USER_INPUT');
  });

  it('should_return_UNAUTHENTICATED_when_no_token_is_provided_on_update', async () => {
    const body = await post(`
      mutation {
        updateProfile(input: { id: "p1", version: 1, displayName: "X" }) { id }
      }
    `);
    expect(body.errors[0].message).toMatch(/bearer token/i);
  });

  it('should_return_NOT_FOUND_when_updating_missing_profile', async () => {
    const body = await post(
      `
      mutation {
        updateProfile(input: { id: "missing", version: 1, displayName: "X" }) { id }
      }
    `,
      tokenFor('missing'),
    );
    expect(firstErrorCode(body)).toBe('NOT_FOUND');
  });

  it('should_return_PRECONDITION_FAILED_on_version_conflict', async () => {
    const body = await post(
      `
      mutation {
        updateProfile(input: { id: "p1", version: 99, displayName: "X" }) { id }
      }
    `,
      tokenFor('p1'),
    );
    expect(firstErrorCode(body)).toBe('PRECONDITION_FAILED');
  });

  it('should_return_FORBIDDEN_when_token_owner_does_not_match_target_profile', async () => {
    const body = await post(
      `
      mutation {
        updateProfile(input: { id: "p1", version: 1, displayName: "X" }) { id }
      }
    `,
      tokenFor('p2'),
    );
    expect(firstErrorCode(body)).toBe('FORBIDDEN');
  });

  it('should_return_NOT_FOUND_when_deleting_missing_profile', async () => {
    const body = await post(
      `mutation { deleteProfile(id: "missing") }`,
      tokenFor('missing'),
    );
    expect(firstErrorCode(body)).toBe('NOT_FOUND');
  });

  it('should_return_null_not_error_for_missing_profile_query', async () => {
    const body = await post(`query { profile(id: "missing") { id } }`);
    expect(body.errors).toBeUndefined();
    expect(body.data.profile).toBeNull();
  });
});
