import request from 'supertest';
import { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';

import { AntiCheatService } from '@/modules/anti-cheat/anti-cheat.service';
import { createE2eApp } from './setup-e2e-app';

describe('Leaderboard API (e2e)', () => {
  let app: INestApplication<App>;
  let guestId: string;
  let antiCheatService: AntiCheatService;

  beforeAll(async () => {
    app = await createE2eApp();
    antiCheatService = app.get(AntiCheatService);
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
    const seed = Math.floor(Math.random() * 1_000_000);
    const payload = {
      score: 850,
      duration: 30,
      seed,
      moves: [{ action: 'tap', x: 1, y: 2, id: crypto.randomUUID() }],
      replayHash: '',
    };
    payload.replayHash = antiCheatService.computeReplayHash(payload);

    const response = await request(app.getHttpServer())
      .post('/game/sync')
      .send({
        guestId,
        results: [payload],
      })
      .expect(201);

    expect(response.body.data.accepted).toBe(1);
    expect(response.body.data.rejected).toBe(0);
    expect(response.body.data.bestScore).toBeGreaterThanOrEqual(850);
  });

  it('POST /game/sync is idempotent for duplicate replay hash', async () => {
    const seed = Math.floor(Math.random() * 1_000_000) + 1_000_000;
    const moves = [{ action: 'tap', x: 2, y: 3, id: crypto.randomUUID() }];
    const payload = {
      score: 900,
      duration: 30,
      seed,
      moves,
      replayHash: antiCheatService.computeReplayHash({
        score: 900,
        duration: 30,
        seed,
        moves,
      }),
    };

    const first = await request(app.getHttpServer())
      .post('/game/sync')
      .send({ guestId, results: [payload] })
      .expect(201);

    expect(first.body.data.accepted).toBe(1);

    const second = await request(app.getHttpServer())
      .post('/game/sync')
      .send({ guestId, results: [payload] })
      .expect(201);

    expect(second.body.data.accepted).toBe(1);
    expect(second.body.data.rejected).toBe(0);
  });

  it('GET /leaderboard/global returns top players', async () => {
    const response = await request(app.getHttpServer())
      .get('/leaderboard/global')
      .query({ guestId, page: 1, limit: 10 })
      .expect(200);

    expect(response.body.data).toHaveProperty('top');
    expect(Array.isArray(response.body.data.top)).toBe(true);
    expect(response.body.data).toHaveProperty('myRank');
  });

  it('GET /leaderboard/weekly returns weekly standings', async () => {
    const response = await request(app.getHttpServer())
      .get('/leaderboard/weekly')
      .query({ guestId, page: 1, limit: 10 })
      .expect(200);

    expect(response.body.data).toHaveProperty('top');
    expect(Array.isArray(response.body.data.top)).toBe(true);
  });
});
