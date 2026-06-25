import { createHash } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';

import { createE2eApp } from './setup-e2e-app';

const GAME_ID = 'puzzle-quest';

function computeReplayHash(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

describe('Leaderboard API (e2e)', () => {
  let app: INestApplication<App>;
  let guestId: string;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /guest/init creates a guest player', async () => {
    const response = await request(app.getHttpServer()).post('/guest/init').expect(201);

    expect(response.body.data).toHaveProperty('guestId');
    guestId = response.body.data.guestId;
  });

  it('POST /game/sync accepts valid offline results', async () => {
    const payload = {
      score: 850,
      duration: 30,
      replayHash: computeReplayHash({ score: 850, duration: 30, nonce: crypto.randomUUID() }),
      metadata: { level: 3 },
    };

    const response = await request(app.getHttpServer())
      .post('/game/sync')
      .send({
        gameId: GAME_ID,
        guestId,
        results: [payload],
      })
      .expect(201);

    expect(response.body.data.accepted).toBe(1);
    expect(response.body.data.rejected).toBe(0);
    expect(response.body.data.bestScore).toBeGreaterThanOrEqual(850);
  });

  it('POST /game/sync is idempotent for duplicate replay hash', async () => {
    const replayHash = computeReplayHash({ score: 900, duration: 30, nonce: crypto.randomUUID() });
    const payload = {
      score: 900,
      duration: 30,
      replayHash,
    };

    const first = await request(app.getHttpServer())
      .post('/game/sync')
      .send({ gameId: GAME_ID, guestId, results: [payload] })
      .expect(201);

    expect(first.body.data.accepted).toBe(1);

    const second = await request(app.getHttpServer())
      .post('/game/sync')
      .send({ gameId: GAME_ID, guestId, results: [payload] })
      .expect(201);

    expect(second.body.data.accepted).toBe(1);
    expect(second.body.data.rejected).toBe(0);
  });

  it('GET /leaderboard/global returns top players', async () => {
    const response = await request(app.getHttpServer())
      .get('/leaderboard/global')
      .query({ gameId: GAME_ID, guestId, limit: 10 })
      .expect(200);

    expect(response.body.data).toHaveProperty('top');
    expect(Array.isArray(response.body.data.top)).toBe(true);
    expect(response.body.data).toHaveProperty('myRank');
  });
});
