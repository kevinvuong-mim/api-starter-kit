import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { GameRegistryService } from '@/modules/game/game-registry.service';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class LeaderboardMaintenanceService {
  private readonly logger = new Logger(LeaderboardMaintenanceService.name);

  constructor(
    private readonly gameRegistryService: GameRegistryService,
    private readonly redisRankingService: RedisRankingService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 3 * * *')
  async rebuildRedisLeaderboards(): Promise<void> {
    this.logger.log('Rebuilding Redis leaderboards from database');

    const games = await this.gameRegistryService.getActiveGames();

    for (const game of games) {
      const entries = await this.prisma.leaderboard.findMany({
        where: { gameId: game.id },
        select: { guestId: true, bestScore: true },
        orderBy: { bestScore: 'desc' },
      });

      await this.redisRankingService.rebuildGlobal(game.id, entries);
      this.logger.log(`Rebuilt Redis leaderboard for game ${game.id}`);
    }

    this.logger.log('Redis leaderboard rebuild complete');
  }
}
