import Redis from 'ioredis';
import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';

import { REDIS_CLIENT } from '@/modules/redis/redis.constants';

interface ThrottlerStorageRecord {
  totalHits: number;
  isBlocked: boolean;
  timeToExpire: number;
  timeToBlockExpire: number;
}

const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

if redis.call('EXISTS', blockKey) == 1 then
  local hits = tonumber(redis.call('GET', hitsKey) or limit + 1)
  return { hits, redis.call('PTTL', hitsKey), 1, redis.call('PTTL', blockKey) }
end

local hits = redis.call('INCR', hitsKey)
if hits == 1 then
  redis.call('PEXPIRE', hitsKey, ttl)
end

local timeToExpire = redis.call('PTTL', hitsKey)
if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockDuration)
  return { hits, timeToExpire, 1, blockDuration }
end

return { hits, timeToExpire, 0, 0 }
`;

function secondsRemaining(milliseconds: number): number {
  if (milliseconds <= 0) {
    return 0;
  }

  return Math.ceil(milliseconds / 1000);
}

@Injectable()
export class RedisThrottlerStorageService implements ThrottlerStorage {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const blockDurationMs = blockDuration > 0 ? blockDuration : ttl;
    const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      this.hitsKey(throttlerName, key),
      this.blockKey(throttlerName, key),
      String(ttl),
      String(limit),
      String(blockDurationMs),
    )) as [number, number, number, number];

    return {
      totalHits,
      isBlocked: isBlocked === 1,
      timeToExpire: secondsRemaining(timeToExpireMs),
      timeToBlockExpire: secondsRemaining(timeToBlockExpireMs),
    };
  }

  private hitsKey(throttlerName: string, key: string): string {
    return `throttle:${throttlerName}:${key}:hits`;
  }

  private blockKey(throttlerName: string, key: string): string {
    return `throttle:${throttlerName}:${key}:block`;
  }
}
