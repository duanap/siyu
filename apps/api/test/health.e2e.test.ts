import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';

describe('GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a uniform healthy response and generated request id', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.headers['x-request-id']).toMatch(/^req_/);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        service: 'siyu-api',
      },
      requestId: response.headers['x-request-id'],
    });
    expect(Date.parse(response.body.data.timestamp)).not.toBeNaN();
  });

  it('preserves a valid caller request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'req_client_1234')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('req_client_1234');
    expect(response.body.requestId).toBe('req_client_1234');
  });

  it('returns uniform errors with the same request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/not-found')
      .set('x-request-id', 'req_error_1234')
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      code: 'RESOURCE_NOT_FOUND',
      message: 'Cannot GET /not-found',
      details: {},
      requestId: 'req_error_1234',
    });
    expect(response.headers['x-request-id']).toBe('req_error_1234');
  });
});
