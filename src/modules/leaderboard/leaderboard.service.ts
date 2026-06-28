import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/modules/prisma/prisma.service';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { LeaderboardQueryDto } from '@/modules/leaderboard/dto/leaderboard-query.dto';
import { LeaderboardResponseDto } from '@/modules/leaderboard/dto/leaderboard-response.dto';
import { LeaderboardCacheService } from '@/modules/leaderboard/leaderboard-cache.service';

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameRegistryService: GameRegistryService,
    private readonly leaderboardCacheService: LeaderboardCacheService,
  ) {}

  async getLeaderboard(
    query: LeaderboardQueryDto,
    guestId?: string,
  ): Promise<LeaderboardResponseDto> {
    await this.gameRegistryService.assertGameExists(query.gameId);

    const page = query.page;
    const limit = Math.min(query.limit, 100);
    const offset = (page - 1) * limit;

    const { entries, total } = await this.leaderboardCacheService.getRankings(
      query.gameId,
      limit,
      offset,
    );

    const names = await this.resolveGuestNames(entries.map((entry) => entry.guestId));

    let myRank: number | null = null;
    if (guestId) {
      const inTop = entries.find((entry) => entry.guestId === guestId);
      myRank =
        inTop?.rank ?? (await this.leaderboardCacheService.getPlayerRank(query.gameId, guestId));
    }

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return {
      top: entries.map((entry) => ({
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
}
