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

  beforeEach(() => {
    jest.clearAllMocks();
    redis.ping.mockResolvedValue('PONG');
  });

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

  it('pings redis and handles failures', async () => {
    await expect(service.ping()).resolves.toBe(true);

    redis.ping.mockRejectedValueOnce(new Error('down'));
    await expect(service.ping()).resolves.toBe(false);
  });

  it('reads and writes auth token cache', async () => {
    const guest = { guestId: 'guest-1', gameId: 'FRULOOP' };
    redis.get.mockResolvedValueOnce(JSON.stringify(guest));

    await expect(service.getAuthTokenGuestId('hash')).resolves.toEqual(guest);
    await service.setAuthTokenGuestId('hash', guest);
    expect(redis.set).toHaveBeenCalledWith('auth:token:hash', JSON.stringify(guest), 'EX', 300);
  });

  it('returns null for invalid auth cache payloads', async () => {
    redis.get.mockResolvedValueOnce('not-json');
    await expect(service.getAuthTokenGuestId('hash')).resolves.toBeNull();
  });

  it('reads leaderboard pages and ranks', async () => {
    redis.zcard.mockResolvedValueOnce(2);
    redis.zrevrange.mockResolvedValueOnce(['guest-1', '100', 'guest-2', '90']);
    redis.zscore.mockResolvedValueOnce('100');
    redis.zrevrank.mockResolvedValueOnce(0);

    await expect(service.getLeaderboardCount('FRULOOP')).resolves.toBe(2);
    await expect(service.getLeaderboardTop('FRULOOP', 0, 2)).resolves.toEqual([
      { guestId: 'guest-1', bestScore: 100, rank: 1 },
      { guestId: 'guest-2', bestScore: 90, rank: 2 },
    ]);
    await expect(service.getLeaderboardRank('FRULOOP', 'guest-1')).resolves.toEqual({
      rank: 1,
      bestScore: 100,
    });
  });

  it('returns null when guest is not ranked', async () => {
    redis.zscore.mockResolvedValueOnce(null);
    await expect(service.getLeaderboardRank('FRULOOP', 'missing')).resolves.toBeNull();
  });

  it('updates and rebuilds leaderboard cache', async () => {
    await service.updateLeaderboardScore('FRULOOP', 'guest-1', 1500);
    expect(redis.zadd).toHaveBeenCalledWith('leaderboard:FRULOOP', 1500, 'guest-1');

    await service.rebuildLeaderboard('FRULOOP', [
      { guestId: 'guest-1', bestScore: 1500 },
      { guestId: 'guest-2', bestScore: 1200 },
    ]);
    expect(redis.del).toHaveBeenCalledWith('leaderboard:FRULOOP');
    expect(redis.zadd).toHaveBeenCalledWith(
      'leaderboard:FRULOOP',
      1500,
      'guest-1',
      1200,
      'guest-2',
    );
  });

  it('quits redis on module destroy', async () => {
    await service.onModuleDestroy();
    expect(redis.quit).toHaveBeenCalled();
  });
});
