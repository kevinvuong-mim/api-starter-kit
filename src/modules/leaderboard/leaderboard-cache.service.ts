import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { GameRepository } from '@/modules/game/game.repository';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { LeaderboardEntry } from '@/modules/redis/redis.constants';

export interface LeaderboardRankings {
  entries: LeaderboardEntry[];
  total: number;
  source: 'redis' | 'postgres';
}

@Injectable()
export class LeaderboardCacheService implements OnModuleInit {
  private readonly logger = new Logger(LeaderboardCacheService.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly gameRegistryService: GameRegistryService,
    private readonly redisRankingService: RedisRankingService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.warmAll();
  }

  async warmAll(): Promise<void> {
    this.logger.log('Warming Redis leaderboards from PostgreSQL');

    const games = await this.gameRegistryService.getActiveGames();

    for (const game of games) {
      const entries = await this.gameRepository.getAllLeaderboardEntries(game.id);
      await this.redisRankingService.rebuildGlobal(game.id, entries);
      this.logger.log(`Warmed Redis leaderboard for game ${game.id} (${entries.length} entries)`);
    }
  }

  async getRankings(gameId: string, limit: number, offset: number): Promise<LeaderboardRankings> {
    const key = this.redisRankingService.getGlobalKey(gameId);
    const [redisCount, pgTotal] = await Promise.all([
      this.redisRankingService.getCount(key),
      this.gameRepository.getLeaderboardCount(gameId),
    ]);

    // Only trust Redis when it is fully in sync with PostgreSQL. A partial flush, a failed
    // warm, or a dropped updateScore would otherwise serve a truncated leaderboard.
    if (redisCount > 0 && redisCount === pgTotal) {
      const entries = await this.redisRankingService.getTop(key, limit, offset);
      return { entries, total: redisCount, source: 'redis' };
    }

    if (pgTotal === 0) {
      if (redisCount > 0) {
        await this.redisRankingService.rebuildGlobal(gameId, []);
      }
      return { entries: [], total: 0, source: 'postgres' };
    }

    // Redis missing or drifted from PG → rebuild from the source of truth, then serve from
    // Redis so ordering/tie-break/pagination stay consistent with the cached path.
    this.logger.warn(
      `Leaderboard drift for game ${gameId} (redis=${redisCount}, pg=${pgTotal}); rebuilding from PostgreSQL`,
    );
    const allEntries = await this.gameRepository.getAllLeaderboardEntries(gameId);
    await this.redisRankingService.rebuildGlobal(gameId, allEntries);

    const entries = await this.redisRankingService.getTop(key, limit, offset);
    return { entries, total: allEntries.length, source: 'postgres' };
  }

  async getPlayerRank(gameId: string, guestId: string): Promise<number | null> {
    const key = this.redisRankingService.getGlobalKey(gameId);
    const rankInfo = await this.redisRankingService.getPlayerRank(key, guestId);

    if (rankInfo) {
      return rankInfo.rank;
    }

    return this.gameRepository.getPlayerRank(gameId, guestId);
  }
}
