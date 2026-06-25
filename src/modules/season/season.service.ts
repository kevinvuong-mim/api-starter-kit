import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Season } from '@prisma/client';

import { SeasonRepository } from '@/modules/season/season.repository';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class SeasonService implements OnModuleInit {
  private readonly logger = new Logger(SeasonService.name);

  constructor(
    private readonly seasonRepository: SeasonRepository,
    private readonly gameRegistryService: GameRegistryService,
    private readonly redisRankingService: RedisRankingService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureActiveSeasons();
  }

  async getActiveWeeklySeason(gameId: string): Promise<Season> {
    await this.gameRegistryService.assertActiveGame(gameId);

    const season = await this.seasonRepository.findActiveWeekly(gameId);
    if (season) {
      return season;
    }

    return this.seasonRepository.createWeekly(gameId);
  }

  async ensureActiveSeasons(): Promise<void> {
    const games = await this.gameRegistryService.getActiveGames();

    for (const game of games) {
      const season = await this.getActiveWeeklySeason(game.id);
      this.logger.log(`Active weekly season for ${game.id}: ${season.id}`);
    }
  }

  @Cron('0 0 * * 1')
  async rotateWeeklySeasons(): Promise<void> {
    this.logger.log('Starting weekly season rotation for all games');

    const games = await this.gameRegistryService.getActiveGames();
    const now = new Date();

    for (const game of games) {
      const activeSeason = await this.seasonRepository.findActiveWeekly(game.id);
      if (activeSeason) {
        await this.seasonRepository.closeSeason(activeSeason.id, now);
        await this.snapshotWeeklyLeaderboard(game.id, activeSeason.id);
        this.logger.log(`Closed season ${activeSeason.id} for game ${game.id}`);
      }

      const newSeason = await this.seasonRepository.createWeekly(game.id, now);
      await this.redisRankingService.rebuildWeekly(game.id, newSeason.id, []);
      this.logger.log(`Created new weekly season ${newSeason.id} for game ${game.id}`);
    }
  }

  @Cron('0 3 * * *')
  async rebuildRedisLeaderboards(): Promise<void> {
    this.logger.log('Rebuilding Redis leaderboards from database');

    const games = await this.gameRegistryService.getActiveGames();

    for (const game of games) {
      const globalEntries = await this.prisma.leaderboardGlobal.findMany({
        where: { gameId: game.id },
        select: { guestId: true, bestScore: true },
        orderBy: { bestScore: 'desc' },
      });

      await this.redisRankingService.rebuildGlobal(game.id, globalEntries);

      const activeSeason = await this.getActiveWeeklySeason(game.id);
      const weeklyEntries = await this.prisma.leaderboardWeekly.findMany({
        where: {
          gameId: game.id,
          seasonId: activeSeason.id,
        },
        select: { guestId: true, bestScore: true },
        orderBy: { bestScore: 'desc' },
      });

      await this.redisRankingService.rebuildWeekly(game.id, activeSeason.id, weeklyEntries);
      this.logger.log(`Rebuilt Redis leaderboards for game ${game.id}`);
    }

    this.logger.log('Redis leaderboard rebuild complete');
  }

  private async snapshotWeeklyLeaderboard(gameId: string, seasonId: string): Promise<void> {
    const entries = await this.prisma.leaderboardWeekly.findMany({
      where: { gameId, seasonId },
      orderBy: { bestScore: 'desc' },
      take: 100,
    });

    this.logger.log(
      `Snapshotted ${entries.length} entries for game ${gameId}, season ${seasonId}`,
    );
  }
}
