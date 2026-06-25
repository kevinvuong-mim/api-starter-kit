import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/modules/prisma/prisma.service';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { LeaderboardQueryDto } from '@/modules/leaderboard/dto/leaderboard-query.dto';
import { LeaderboardResponseDto } from '@/modules/leaderboard/dto/leaderboard-response.dto';

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameRegistryService: GameRegistryService,
    private readonly redisRankingService: RedisRankingService,
  ) {}

  async getGlobalLeaderboard(
    query: LeaderboardQueryDto,
    guestId?: string,
  ): Promise<LeaderboardResponseDto> {
    await this.gameRegistryService.assertActiveGame(query.gameId);

    const page = query.page;
    const limit = Math.min(query.limit, 100);
    const offset = (page - 1) * limit;
    const key = this.redisRankingService.getGlobalKey(query.gameId);

    const [top, total] = await Promise.all([
      this.redisRankingService.getTop(key, limit, offset),
      this.redisRankingService.getCount(key),
    ]);

    const names = await this.resolveGuestNames(top.map((entry) => entry.guestId));

    let myRank: number | null = null;
    if (guestId) {
      myRank = await this.resolveMyRank(key, guestId, top);
    }

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return {
      top: top.map((entry) => ({
        ...entry,
        name: names.get(entry.guestId) ?? null,
      })),
      myRank,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  private async resolveGuestNames(guestIds: string[]): Promise<Map<string, string | null>> {
    if (guestIds.length === 0) {
      return new Map();
    }

    const guests = await this.prisma.guestPlayer.findMany({
      where: { id: { in: guestIds } },
      select: { id: true, name: true },
    });

    return new Map(guests.map((guest) => [guest.id, guest.name]));
  }

  private async resolveMyRank(
    key: string,
    guestId: string,
    top: Array<{ guestId: string; rank: number }>,
  ): Promise<number | null> {
    const inTop = top.find((entry) => entry.guestId === guestId);
    if (inTop) {
      return inTop.rank;
    }

    const rankInfo = await this.redisRankingService.getPlayerRank(key, guestId);
    return rankInfo?.rank ?? null;
  }
}
