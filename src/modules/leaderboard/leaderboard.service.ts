import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GAME_CONFIG_KEY, GameConfig } from '@/config/game.config';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { LeaderboardQueryDto } from '@/modules/leaderboard/dto/leaderboard-query.dto';
import { LeaderboardResponseDto } from '@/modules/leaderboard/dto/leaderboard-response.dto';

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly redisRankingService: RedisRankingService,
    private readonly gameRegistryService: GameRegistryService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get config(): GameConfig {
    return this.configService.get<GameConfig>(GAME_CONFIG_KEY)!;
  }

  async getGlobalLeaderboard(query: LeaderboardQueryDto): Promise<LeaderboardResponseDto> {
    await this.gameRegistryService.assertActiveGame(query.gameId);

    const limit = Math.min(query.limit ?? this.config.leaderboardTopLimit, this.config.leaderboardTopLimit);
    const key = this.redisRankingService.getGlobalKey(query.gameId);
    const top = await this.redisRankingService.getTop(key, limit, 0);
    const names = await this.resolveGuestNames(top.map((entry) => entry.guestId));

    let myRank: number | null = null;
    if (query.guestId) {
      myRank = await this.resolveMyRank(key, query.guestId, top);
    }

    return {
      top: top.map((entry) => ({
        ...entry,
        name: names.get(entry.guestId) ?? null,
      })),
      myRank,
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
