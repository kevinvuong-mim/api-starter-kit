import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters';
import { ResponseInterceptor } from '@/common/interceptors';
import { buildValidReplayHash } from './helpers/replay-hash.helper';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

describeIfDb('Platform flows (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await prisma.game.upsert({
      where: { id: 'puzzle-quest' },
      create: {
        id: 'puzzle-quest',
        name: 'Puzzle Quest',
        config: { replaySecret: 'puzzle-quest-dev-secret' },
      },
      update: {
        config: { replaySecret: 'puzzle-quest-dev-secret' },
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates one guest per installId and returns the same guest on re-init', async () => {
    const installId = randomUUID();

    const createRes = await request(app.getHttpServer())
      .post('/api/guest/init')
      .send({ installId })
      .expect(201);

    expect(createRes.body.data.relinked).toBe(false);
    expect(createRes.body.data.sessionToken).toBeUndefined();
    expect(createRes.body.data.installSecret).toBeUndefined();

    const { guestId } = createRes.body.data;

    const relinkRes = await request(app.getHttpServer())
      .post('/api/guest/init')
      .send({ installId })
      .expect(201);

    expect(relinkRes.body.data.relinked).toBe(true);
    expect(relinkRes.body.data.guestId).toBe(guestId);

    const profileRes = await request(app.getHttpServer())
      .get(`/api/guest/me?guestId=${guestId}`)
      .expect(200);

    expect(profileRes.body.data).toMatchObject({
      guestId,
      name: null,
    });
    expect(profileRes.body.data.installId).toBeUndefined();
  });

  it('syncs game results with per-item response and idempotent retry', async () => {
    const installId = randomUUID();
    const initRes = await request(app.getHttpServer())
      .post('/api/guest/init')
      .send({ installId })
      .expect(201);

    const guestId = initRes.body.data.guestId;
    const runSeed = 'e2e-run-1';
    const score = 1500;
    const replayHash = buildValidReplayHash('puzzle-quest', score, runSeed);

    const syncRes = await request(app.getHttpServer())
      .post('/api/games/puzzle-quest/results')
      .send({
        guestId,
        results: [
          {
            score,
            replayHash,
            metadata: { runSeed },
          },
        ],
      })
      .expect(201);

    expect(syncRes.body.data).toMatchObject({
      accepted: 1,
      rejected: 0,
      bestScore: score,
    });
    expect(syncRes.body.data.results[0]).toEqual({
      replayHash,
      status: 'accepted',
    });

    const retryRes = await request(app.getHttpServer())
      .post('/api/games/puzzle-quest/results')
      .send({
        guestId,
        results: [
          {
            score,
            replayHash,
            metadata: { runSeed },
          },
        ],
      })
      .expect(201);

    expect(retryRes.body.data).toMatchObject({
      accepted: 1,
      rejected: 0,
      bestScore: score,
    });
  });

  it('rejects invalid replay signature', async () => {
    const initRes = await request(app.getHttpServer()).post('/api/guest/init').send({}).expect(201);
    const guestId = initRes.body.data.guestId;

    const syncRes = await request(app.getHttpServer())
      .post('/api/games/puzzle-quest/results')
      .send({
        guestId,
        results: [
          {
            score: 999,
            replayHash: 'c'.repeat(64),
            metadata: { runSeed: 'bad' },
          },
        ],
      })
      .expect(201);

    expect(syncRes.body.data).toMatchObject({
      accepted: 0,
      rejected: 1,
    });
    expect(syncRes.body.data.results[0].reason).toBe('INVALID_REPLAY_SIGNATURE');
  });
});
