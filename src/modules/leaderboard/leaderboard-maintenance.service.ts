import { Cron } from '@nestjs/schedule';
import { Logger, Injectable } from '@nestjs/common';

import { PrismaService } from '@/modules/prisma/prisma.service';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';

@Injectable()
export class LeaderboardMaintenanceService {
  private readonly logger = new Logger(LeaderboardMaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gameRegistryService: GameRegistryService,
    private readonly redisRankingService: RedisRankingService,
  ) {}

  @Cron('0 3 * * *')
  async rebuildRedisLeaderboards(): Promise<void> {
    this.logger.log('Rebuilding Redis leaderboards from database');

    const games = await this.gameRegistryService.getActiveGames();

    for (const game of games) {
      const entries = await this.prisma.leaderboard.findMany({
        where: { gameId: game.id },
        orderBy: { bestScore: 'desc' },
        select: { guestId: true, bestScore: true },
      });

      await this.redisRankingService.rebuildGlobal(game.id, entries);
      this.logger.log(`Rebuilt Redis leaderboard for game ${game.id}`);
    }

    this.logger.log('Redis leaderboard rebuild complete');
  }
}
