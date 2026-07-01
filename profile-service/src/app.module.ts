import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLFormattedError } from 'graphql';
import { ProfileModule } from './profile.module';
import { HealthModule } from './health/health.module';
import { DomainExceptionFilter } from './presentation/graphql/domain-exception.filter';
import { isIntrospectionEnabled } from './graphql.config';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      introspection: isIntrospectionEnabled(process.env.NODE_ENV),
      playground: isIntrospectionEnabled(process.env.NODE_ENV),
      formatError: (formattedError: GraphQLFormattedError) => ({
        message: formattedError.message,
        path: formattedError.path,
        extensions: {
          code: formattedError.extensions?.code ?? 'INTERNAL_SERVER_ERROR',
          domainCode: formattedError.extensions?.domainCode,
          httpStatus: formattedError.extensions?.httpStatus,
        },
      }),
    }),
    ProfileModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
  ],
})
export class AppModule {}
