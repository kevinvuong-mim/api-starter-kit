import Redis from 'ioredis';
import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  REDIS_CLIENT,
  REDIS_KEYS,
  LeaderboardEntry,
  NearbyRanksResult,
} from '@/modules/redis/redis.constants';
import { GAME_CONFIG_KEY, GameConfig } from '@/config/game.config';

@Injectable()
export class RedisRankingService implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }

  private get topLimit(): number {
    return this.configService.get<GameConfig>(GAME_CONFIG_KEY)!.leaderboardTopLimit;
  }

  private get nearbyRange(): number {
    return this.configService.get<GameConfig>(GAME_CONFIG_KEY)!.nearbyRankRange;
  }

  async updateScore(key: string, guestId: string, score: number): Promise<void> {
    const currentScore = await this.redis.zscore(key, guestId);
    if (currentScore !== null && Number(currentScore) >= score) {
      return;
    }

    await this.redis.zadd(key, score, guestId);
  }

  async getTop(key: string, limit = this.topLimit, offset = 0): Promise<LeaderboardEntry[]> {
    const cappedLimit = Math.min(limit, this.topLimit);
    const results = await this.redis.zrevrange(key, offset, offset + cappedLimit - 1, 'WITHSCORES');

    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({
        guestId: results[i],
        score: Number(results[i + 1]),
        rank: offset + i / 2 + 1,
      });
    }

    return entries;
  }

  async getPlayerRank(key: string, guestId: string): Promise<{ rank: number; score: number } | null> {
    const score = await this.redis.zscore(key, guestId);
    if (score === null) {
      return null;
    }

    const rank = await this.redis.zrevrank(key, guestId);
    if (rank === null) {
      return null;
    }

    return { rank: rank + 1, score: Number(score) };
  }

  async getNearbyRanks(key: string, guestId: string): Promise<NearbyRanksResult | null> {
    const playerRank = await this.getPlayerRank(key, guestId);
    if (!playerRank) {
      return null;
    }

    const start = Math.max(0, playerRank.rank - 1 - this.nearbyRange);
    const end = playerRank.rank - 1 + this.nearbyRange;
    const nearby = await this.getTop(key, end - start + 1, start);

    return {
      rank: playerRank.rank,
      score: playerRank.score,
      nearby,
    };
  }

  async rebuildGlobal(entries: Array<{ guestId: string; bestScore: number }>): Promise<void> {
    const key = REDIS_KEYS.global;
    await this.redis.del(key);

    if (entries.length === 0) {
      return;
    }

    const args: Array<string | number> = [];
    for (const entry of entries) {
      args.push(entry.bestScore, entry.guestId);
    }

    await this.redis.zadd(key, ...args);
  }

  async rebuildWeekly(
    seasonId: string,
    entries: Array<{ guestId: string; bestScore: number }>,
  ): Promise<void> {
    const key = REDIS_KEYS.weekly(seasonId);
    await this.redis.del(key);

    if (entries.length === 0) {
      return;
    }

    const args: Array<string | number> = [];
    for (const entry of entries) {
      args.push(entry.bestScore, entry.guestId);
    }

    await this.redis.zadd(key, ...args);
  }

  getGlobalKey(): string {
    return REDIS_KEYS.global;
  }

  getWeeklyKey(seasonId: string): string {
    return REDIS_KEYS.weekly(seasonId);
  }
}

export function createRedisClient(configService: ConfigService): Redis {
  const url = configService.get<string>('REDIS_URL');
  if (!url) {
    throw new Error('REDIS_URL is not configured');
  }

  return new Redis(url, { maxRetriesPerRequest: null });
}
