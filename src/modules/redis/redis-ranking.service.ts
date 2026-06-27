import Redis from 'ioredis';
import { Inject, Logger, Injectable, OnModuleDestroy } from '@nestjs/common';

import {
  decodeLeaderboardScore,
  encodeLeaderboardScore,
} from '@/common/utils/leaderboard-score.util';
import { REDIS_KEYS, REDIS_CLIENT, LeaderboardEntry } from '@/modules/redis/redis.constants';

const LEADERBOARD_TOP_LIMIT = 100;
const REDIS_UPDATE_MAX_RETRIES = 3;
const REDIS_UPDATE_RETRY_DELAY_MS = 100;

// Atomic: chỉ cập nhật khi encoded score mới lớn hơn score hiện tại (hoặc member chưa tồn tại).
const UPDATE_SCORE_SCRIPT = `
local current = redis.call('ZSCORE', KEYS[1], ARGV[1])
if current == false or tonumber(ARGV[2]) > tonumber(current) then
  return redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
end
return 0
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class RedisRankingService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisRankingService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async updateScore(key: string, guestId: string, bestScore: number): Promise<void> {
    const encodedScore = encodeLeaderboardScore(bestScore, guestId);

    for (let attempt = 1; attempt <= REDIS_UPDATE_MAX_RETRIES; attempt++) {
      try {
        await this.redis.eval(UPDATE_SCORE_SCRIPT, 1, key, guestId, String(encodedScore));
        return;
      } catch (error) {
        if (attempt === REDIS_UPDATE_MAX_RETRIES) {
          this.logger.warn(
            `Redis updateScore failed after ${REDIS_UPDATE_MAX_RETRIES} attempts for ${key}/${guestId}`,
            error instanceof Error ? error.stack : error,
          );
          return;
        }

        await sleep(REDIS_UPDATE_RETRY_DELAY_MS * attempt);
      }
    }
  }

  async getTop(
    key: string,
    limit = LEADERBOARD_TOP_LIMIT,
    offset = 0,
  ): Promise<LeaderboardEntry[]> {
    const cappedLimit = Math.min(limit, LEADERBOARD_TOP_LIMIT);
    const results = await this.redis.zrevrange(key, offset, offset + cappedLimit - 1, 'WITHSCORES');

    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({
        guestId: results[i],
        score: decodeLeaderboardScore(Number(results[i + 1])),
        rank: offset + i / 2 + 1,
      });
    }

    return entries;
  }

  async getCount(key: string): Promise<number> {
    return this.redis.zcard(key);
  }

  async getPlayerRank(
    key: string,
    guestId: string,
  ): Promise<{ rank: number; score: number } | null> {
    const encodedScore = await this.redis.zscore(key, guestId);
    if (encodedScore === null) {
      return null;
    }

    const rank = await this.redis.zrevrank(key, guestId);
    if (rank === null) {
      return null;
    }

    return {
      rank: rank + 1,
      score: decodeLeaderboardScore(Number(encodedScore)),
    };
  }

  async rebuildGlobal(
    gameId: string,
    entries: Array<{ guestId: string; bestScore: number }>,
  ): Promise<void> {
    const key = REDIS_KEYS.global(gameId);
    await this.redis.del(key);

    if (entries.length === 0) {
      return;
    }

    const args: Array<string | number> = [];
    for (const entry of entries) {
      args.push(encodeLeaderboardScore(entry.bestScore, entry.guestId), entry.guestId);
    }

    await this.redis.zadd(key, ...args);
  }

  getGlobalKey(gameId: string): string {
    return REDIS_KEYS.global(gameId);
  }
}

export function createRedisClient(configService: {
  get: (key: string) => string | undefined;
}): Redis {
  const url = configService.get('REDIS_URL');
  if (!url) {
    throw new Error('REDIS_URL is not configured');
  }

  return new Redis(url, { maxRetriesPerRequest: null });
}
