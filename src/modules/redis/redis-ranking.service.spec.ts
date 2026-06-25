import Redis from 'ioredis';

import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { REDIS_KEYS } from '@/modules/redis/redis.constants';
import { GAME_CONFIG_KEY } from '@/config/game.config';

describe('RedisRankingService', () => {
  let service: RedisRankingService;
  let redis: jest.Mocked<Redis>;

  const gameConfig = {
    leaderboardTopLimit: 100,
  };

  const gameId = 'puzzle-quest';

  beforeEach(() => {
    redis = {
      zscore: jest.fn(),
      zadd: jest.fn(),
      zrevrange: jest.fn(),
      zrevrank: jest.fn(),
      del: jest.fn(),
      quit: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    service = new RedisRankingService(redis, {
      get: (key: string) => (key === GAME_CONFIG_KEY ? gameConfig : undefined),
    } as never);
  });

  it('updates score when new score is higher', async () => {
    const key = REDIS_KEYS.global(gameId);
    redis.zscore.mockResolvedValue('100');
    await service.updateScore(key, 'guest-1', 200);
    expect(redis.zadd).toHaveBeenCalledWith(key, 200, 'guest-1');
  });

  it('skips update when score is not higher', async () => {
    const key = REDIS_KEYS.global(gameId);
    redis.zscore.mockResolvedValue('500');
    await service.updateScore(key, 'guest-1', 200);
    expect(redis.zadd).not.toHaveBeenCalled();
  });

  it('returns top entries with ranks', async () => {
    const key = REDIS_KEYS.global(gameId);
    redis.zrevrange.mockResolvedValue(['guest-1', '1000', 'guest-2', '900']);

    const top = await service.getTop(key, 2, 0);
    expect(top).toEqual([
      { guestId: 'guest-1', score: 1000, rank: 1 },
      { guestId: 'guest-2', score: 900, rank: 2 },
    ]);
  });

  it('returns player rank', async () => {
    const key = REDIS_KEYS.global(gameId);
    redis.zscore.mockResolvedValue('750');
    redis.zrevrank.mockResolvedValue(4);

    const rank = await service.getPlayerRank(key, 'guest-1');
    expect(rank).toEqual({ rank: 5, score: 750 });
  });
});
