import request from 'supertest';
import { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';

import { createE2eApp } from './setup-e2e-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('path', '/');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('statusCode', 200);
        expect(res.body).toHaveProperty('data', 'Hello World!');
        expect(res.body).toHaveProperty('message', 'Data retrieved successfully');
      });
  });
});
