import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { setupSwagger } from '../../src/swagger';

describe('setupSwagger', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({}).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should_register_docs_route_without_throwing', () => {
    expect(() => setupSwagger(app)).not.toThrow();

    const server = app.getHttpAdapter().getInstance();
    const stack = server._router?.stack ?? server.router?.stack ?? [];
    const hasDocsRoute = stack.some((layer: { regexp?: RegExp }) =>
      layer.regexp?.test('/api/docs'),
    );
    expect(hasDocsRoute).toBe(true);
  });
});
