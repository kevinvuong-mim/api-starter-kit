import { Injectable } from '@nestjs/common';

import { GuestService } from '@/modules/guest/guest.service';
import { ReplayService } from '@/modules/replay/replay.service';
import { SeasonService } from '@/modules/season/season.service';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { GameRepository } from '@/modules/game/game.repository';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { GameResultDto } from '@/modules/game/dto/sync-game-results.dto';
import { SyncGameResultsResponseDto } from '@/modules/game/dto/sync-game-results-response.dto';

@Injectable()
export class GameService {
  constructor(
    private readonly guestService: GuestService,
    private readonly replayService: ReplayService,
    private readonly gameRegistryService: GameRegistryService,
    private readonly seasonService: SeasonService,
    private readonly redisRankingService: RedisRankingService,
    private readonly gameRepository: GameRepository,
    private readonly prisma: PrismaService,
  ) {}

  async syncResults(
    gameId: string,
    guestId: string,
    results: GameResultDto[],
  ): Promise<SyncGameResultsResponseDto> {
    await this.gameRegistryService.assertActiveGame(gameId);
    await this.guestService.getGuestOrThrow(guestId);

    let accepted = 0;
    let rejected = 0;

    for (const result of results) {
      const existing = await this.gameRepository.findByReplayHash(gameId, result.replayHash);
      if (existing) {
        if (existing.guestId === guestId) {
          accepted += 1;
        } else {
          rejected += 1;
        }
        continue;
      }

      const validation = await this.replayService.validate(gameId, guestId, result);
      if (!validation.valid) {
        rejected += 1;
        continue;
      }

      await this.gameRepository.createResult(gameId, guestId, result);
      await this.updateLeaderboards(gameId, guestId, result.score);
      accepted += 1;
    }

    const bestScore = await this.gameRepository.getBestScoreForGuest(gameId, guestId);

    return { accepted, rejected, bestScore };
  }

  private async updateLeaderboards(
    gameId: string,
    guestId: string,
    score: number,
  ): Promise<void> {
    const activeSeason = await this.seasonService.getActiveWeeklySeason(gameId);

    await this.prisma.$transaction(async (tx) => {
      const globalEntry = await tx.leaderboardGlobal.findUnique({
        where: { gameId_guestId: { gameId, guestId } },
      });

      if (!globalEntry || score > globalEntry.bestScore) {
        await tx.leaderboardGlobal.upsert({
          where: { gameId_guestId: { gameId, guestId } },
          create: { gameId, guestId, bestScore: score },
          update: { bestScore: score },
        });
        await this.redisRankingService.updateScore(
          this.redisRankingService.getGlobalKey(gameId),
          guestId,
          score,
        );
      }

      const weeklyEntry = await tx.leaderboardWeekly.findUnique({
        where: {
          gameId_seasonId_guestId: {
            gameId,
            seasonId: activeSeason.id,
            guestId,
          },
        },
      });

      if (!weeklyEntry || score > weeklyEntry.bestScore) {
        await tx.leaderboardWeekly.upsert({
          where: {
            gameId_seasonId_guestId: {
              gameId,
              seasonId: activeSeason.id,
              guestId,
            },
          },
          create: {
            gameId,
            seasonId: activeSeason.id,
            guestId,
            bestScore: score,
          },
          update: { bestScore: score },
        });
        await this.redisRankingService.updateScore(
          this.redisRankingService.getWeeklyKey(gameId, activeSeason.id),
          guestId,
          score,
        );
      }
    });
  }
}
