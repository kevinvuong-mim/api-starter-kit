import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GuestStatus } from '@prisma/client';

import { GAME_CONFIG_KEY, GameConfig } from '@/config/game.config';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { SeasonService } from '@/modules/season/season.service';
import { GuestRepository } from '@/modules/guest/guest.repository';
import { LeaderboardQueryDto } from '@/modules/leaderboard/dto/leaderboard-query.dto';
import { LeaderboardResponseDto } from '@/modules/leaderboard/dto/leaderboard-response.dto';

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly redisRankingService: RedisRankingService,
    private readonly seasonService: SeasonService,
    private readonly guestRepository: GuestRepository,
    private readonly configService: ConfigService,
  ) {}

  private get config(): GameConfig {
    return this.configService.get<GameConfig>(GAME_CONFIG_KEY)!;
  }

  async getGlobalLeaderboard(query: LeaderboardQueryDto): Promise<LeaderboardResponseDto> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, this.config.leaderboardTopLimit);
    const offset = (page - 1) * limit;

    const key = this.redisRankingService.getGlobalKey();
    const top = await this.redisRankingService.getTop(key, limit, offset);
    const filteredTop = await this.filterEligibleEntries(top);

    let myRank: number | null = null;
    if (query.guestId) {
      myRank = await this.resolveMyRank(key, query.guestId, filteredTop);
    }

    return { top: filteredTop, myRank };
  }

  async getWeeklyLeaderboard(query: LeaderboardQueryDto): Promise<LeaderboardResponseDto> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, this.config.leaderboardTopLimit);
    const offset = (page - 1) * limit;

    const season = await this.seasonService.getActiveWeeklySeason();
    const key = this.redisRankingService.getWeeklyKey(season.id);
    const top = await this.redisRankingService.getTop(key, limit, offset);
    const filteredTop = await this.filterEligibleEntries(top);

    let myRank: number | null = null;
    if (query.guestId) {
      myRank = await this.resolveMyRank(key, query.guestId, filteredTop);
    }

    return { top: filteredTop, myRank };
  }

  private async filterEligibleEntries(
    entries: Array<{ guestId: string; score: number; rank: number }>,
  ): Promise<Array<{ guestId: string; score: number; rank: number }>> {
    const guestIds = entries.map((entry) => entry.guestId);
    const eligibleGuests = await this.guestRepository.findEligibleForLeaderboard(guestIds);
    const eligibleIds = new Set(eligibleGuests.map((guest) => guest.id));

    return entries
      .filter((entry) => eligibleIds.has(entry.guestId))
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }

  private async resolveMyRank(
    key: string,
    guestId: string,
    top: Array<{ guestId: string; rank: number }>,
  ): Promise<number | null> {
    const guest = await this.guestRepository.findById(guestId);
    if (!guest || guest.status !== GuestStatus.NORMAL) {
      return null;
    }

    const inTop = top.find((entry) => entry.guestId === guestId);
    if (inTop) {
      return inTop.rank;
    }

    const rankInfo = await this.redisRankingService.getPlayerRank(key, guestId);
    return rankInfo?.rank ?? null;
  }
}
