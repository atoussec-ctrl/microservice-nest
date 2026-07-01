import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Profile Service API')
    .setDescription(
      [
        'User profiles microservice — **NestJS + GraphQL + PostgreSQL + OpenSearch**.',
        '',
        '## Write model (strong consistency)',
        '- `createProfile`, `updateProfile`, `deleteProfile` persist to PostgreSQL.',
        '- Domain events are written to a **transactional outbox** and published to SNS FIFO.',
        '',
        '## Read model (eventual consistency)',
        '- `profile(id)` reads from PostgreSQL.',
        '- `searchProfiles` reads from OpenSearch (indexed via SQS consumer).',
        '',
        '## GraphQL endpoint',
        'All business operations use **`POST /graphql`**. Import the Postman collection in `docs/postman/` for ready-made queries and mutations.',
        '',
        '### Error codes (GraphQL `extensions.code`)',
        '| Code | HTTP | Meaning |',
        '|------|------|---------|',
        '| `BAD_USER_INPUT` | 400 | Validation failed |',
        '| `CONFLICT` | 409 | Username or email taken |',
        '| `NOT_FOUND` | 404 | Profile not found |',
        '| `PRECONDITION_FAILED` | 412 | Optimistic lock version conflict |',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addTag('Health', 'Service and dependency health checks')
    .addServer('http://localhost:3000', 'Local development')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Profile Service — OpenAPI',
    swaggerOptions: { persistAuthorization: true },
  });
}
