import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Season } from '@prisma/client';

import { SeasonRepository } from '@/modules/season/season.repository';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { GuestStatus } from '@prisma/client';

@Injectable()
export class SeasonService implements OnModuleInit {
  private readonly logger = new Logger(SeasonService.name);

  constructor(
    private readonly seasonRepository: SeasonRepository,
    private readonly redisRankingService: RedisRankingService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureActiveSeason();
  }

  async getActiveWeeklySeason(): Promise<Season> {
    const season = await this.seasonRepository.findActiveWeekly();
    if (season) {
      return season;
    }

    return this.seasonRepository.createWeekly();
  }

  async ensureActiveSeason(): Promise<Season> {
    const season = await this.getActiveWeeklySeason();
    this.logger.log(`Active weekly season: ${season.id}`);
    return season;
  }

  @Cron('0 0 * * 1')
  async rotateWeeklySeason(): Promise<void> {
    this.logger.log('Starting weekly season rotation');

    const activeSeasons = await this.seasonRepository.findAllActiveWeekly();
    const now = new Date();

    for (const season of activeSeasons) {
      await this.seasonRepository.closeSeason(season.id, now);
      await this.snapshotWeeklyLeaderboard(season.id);
      this.logger.log(`Closed season ${season.id}`);
    }

    const newSeason = await this.seasonRepository.createWeekly(now);
    await this.redisRankingService.rebuildWeekly(newSeason.id, []);
    this.logger.log(`Created new weekly season ${newSeason.id}`);
  }

  @Cron('0 3 * * *')
  async rebuildRedisLeaderboards(): Promise<void> {
    this.logger.log('Rebuilding Redis leaderboards from database');

    const globalEntries = await this.prisma.leaderboardGlobal.findMany({
      where: { guest: { status: GuestStatus.NORMAL } },
      select: { guestId: true, bestScore: true },
      orderBy: { bestScore: 'desc' },
    });

    await this.redisRankingService.rebuildGlobal(globalEntries);

    const activeSeason = await this.getActiveWeeklySeason();
    const weeklyEntries = await this.prisma.leaderboardWeekly.findMany({
      where: {
        seasonId: activeSeason.id,
        guest: { status: GuestStatus.NORMAL },
      },
      select: { guestId: true, bestScore: true },
      orderBy: { bestScore: 'desc' },
    });

    await this.redisRankingService.rebuildWeekly(activeSeason.id, weeklyEntries);
    this.logger.log('Redis leaderboard rebuild complete');
  }

  private async snapshotWeeklyLeaderboard(seasonId: string): Promise<void> {
    const entries = await this.prisma.leaderboardWeekly.findMany({
      where: { seasonId },
      orderBy: { bestScore: 'desc' },
      take: 100,
    });

    this.logger.log(`Snapshotted ${entries.length} entries for season ${seasonId}`);
  }
}
