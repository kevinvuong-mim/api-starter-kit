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
  private readonly rebuildsInFlight = new Set<string>();

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly gameRegistryService: GameRegistryService,
    private readonly redisRankingService: RedisRankingService,
  ) {}

  onModuleInit(): void {
    void this.warmAll().catch((error) => {
      this.logger.warn(
        'Initial Redis leaderboard warm failed',
        error instanceof Error ? error.stack : error,
      );
    });
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

    // Redis missing or drifted from PG → serve a PostgreSQL page now and repair Redis in
    // the background. This avoids making a user request pay the full leaderboard rebuild.
    this.logger.warn(
      `Leaderboard drift for game ${gameId} (redis=${redisCount}, pg=${pgTotal}); scheduling Redis rebuild`,
    );
    this.scheduleRebuild(gameId);

    const entries = await this.gameRepository.getLeaderboardEntriesPage(gameId, limit, offset);
    return { entries, total: pgTotal, source: 'postgres' };
  }

  async getPlayerRank(gameId: string, guestId: string): Promise<number | null> {
    const key = this.redisRankingService.getGlobalKey(gameId);
    const rankInfo = await this.redisRankingService.getPlayerRank(key, guestId);

    if (rankInfo) {
      return rankInfo.rank;
    }

    return this.gameRepository.getPlayerRank(gameId, guestId);
  }

  private scheduleRebuild(gameId: string): void {
    if (this.rebuildsInFlight.has(gameId)) {
      return;
    }

    this.rebuildsInFlight.add(gameId);
    void this.rebuildGame(gameId).finally(() => {
      this.rebuildsInFlight.delete(gameId);
    });
  }

  private async rebuildGame(gameId: string): Promise<void> {
    try {
      const allEntries = await this.gameRepository.getAllLeaderboardEntries(gameId);
      await this.redisRankingService.rebuildGlobal(gameId, allEntries);
      this.logger.log(
        `Rebuilt Redis leaderboard for game ${gameId} (${allEntries.length} entries)`,
      );
    } catch (error) {
      this.logger.warn(
        `Redis leaderboard rebuild failed for game ${gameId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
