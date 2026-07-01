import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { setupSwagger } from '../../src/swagger';

describe('setupSwagger', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({}).compile();
    app = moduleRef.createNestApplication();
    setupSwagger(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should_serve_the_openapi_document_at_api_docs_json', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/docs-json',
    );

    expect(response.status).toBe(200);
    expect(response.body.info.title).toBe('Profile Service API');
  });

  it('should_serve_the_swagger_ui_at_api_docs', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
  });
});
