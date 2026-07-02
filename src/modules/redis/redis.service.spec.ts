import { RedisService } from '@/modules/redis/redis.service';

describe('RedisService', () => {
  const redis = {
    incr: jest.fn(),
    expire: jest.fn(),
    quit: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    zcard: jest.fn(),
    zrevrange: jest.fn(),
    zscore: jest.fn(),
    zrevrank: jest.fn(),
    zadd: jest.fn(),
    zremrangebyrank: jest.fn(),
    del: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  const service = new RedisService(redis as never);

  it('allows requests within rate limit window', async () => {
    redis.incr.mockResolvedValueOnce(1);

    const allowed = await service.consumeRateLimit('rate:init:127.0.0.1', 5, 60);
    expect(allowed).toBe(true);
    expect(redis.expire).toHaveBeenCalledWith('rate:init:127.0.0.1', 60);
  });

  it('blocks requests above rate limit window', async () => {
    redis.incr.mockResolvedValueOnce(6);

    const allowed = await service.consumeRateLimit('rate:init:127.0.0.1', 5, 60);
    expect(allowed).toBe(false);
  });
});
