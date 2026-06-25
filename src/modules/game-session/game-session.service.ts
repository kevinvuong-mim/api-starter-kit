import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GuestStatus } from '@prisma/client';

import { GAME_CONFIG_KEY, GameConfig } from '@/config/game.config';
import { GuestService } from '@/modules/guest/guest.service';
import { AntiCheatService } from '@/modules/anti-cheat/anti-cheat.service';
import { SeasonService } from '@/modules/season/season.service';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { GameSessionRepository } from '@/modules/game-session/game-session.repository';
import { GameResultDto } from '@/modules/game-session/dto/sync-game-results.dto';
import { SyncGameResultsResponseDto } from '@/modules/game-session/dto/sync-game-results-response.dto';

@Injectable()
export class GameSessionService {
  constructor(
    private readonly guestService: GuestService,
    private readonly antiCheatService: AntiCheatService,
    private readonly seasonService: SeasonService,
    private readonly redisRankingService: RedisRankingService,
    private readonly gameSessionRepository: GameSessionRepository,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private get config(): GameConfig {
    return this.configService.get<GameConfig>(GAME_CONFIG_KEY)!;
  }

  async syncResults(
    guestId: string,
    results: GameResultDto[],
  ): Promise<SyncGameResultsResponseDto> {
    const guest = await this.guestService.assertCanSync(guestId);
    let accepted = 0;
    let rejected = 0;

    for (const result of results) {
      const existing = await this.gameSessionRepository.findByReplayHash(result.replayHash);
      if (existing) {
        if (existing.guestId === guestId) {
          accepted += 1;
        } else {
          rejected += 1;
          await this.guestService.penalizeGuest(guestId, this.config.trustPenalty);
        }
        continue;
      }

      const validation = await this.antiCheatService.validate(result, guestId);
      if (!validation.valid) {
        rejected += 1;
        await this.guestService.penalizeGuest(guestId, this.config.trustPenalty);
        continue;
      }

      const playedAt = result.playedAt ? new Date(result.playedAt) : undefined;
      await this.gameSessionRepository.createResult(guestId, result, playedAt);

      const currentGuest = await this.guestService.getGuestOrThrow(guestId);
      if (currentGuest.status === GuestStatus.NORMAL) {
        await this.updateLeaderboards(guestId, result.score);
      }

      accepted += 1;
    }

    await this.guestService.touchGuest(guestId);
    const bestScore = await this.gameSessionRepository.getBestScoreForGuest(guestId);

    return { accepted, rejected, bestScore };
  }

  private async updateLeaderboards(guestId: string, score: number): Promise<void> {
    const activeSeason = await this.seasonService.getActiveWeeklySeason();

    await this.prisma.$transaction(async (tx) => {
      const globalEntry = await tx.leaderboardGlobal.findUnique({ where: { guestId } });
      if (!globalEntry || score > globalEntry.bestScore) {
        await tx.leaderboardGlobal.upsert({
          where: { guestId },
          create: { guestId, bestScore: score },
          update: { bestScore: score },
        });
        await this.redisRankingService.updateScore(
          this.redisRankingService.getGlobalKey(),
          guestId,
          score,
        );
      }

      const weeklyEntry = await tx.leaderboardWeekly.findUnique({
        where: { guestId_seasonId: { guestId, seasonId: activeSeason.id } },
      });

      if (!weeklyEntry || score > weeklyEntry.bestScore) {
        await tx.leaderboardWeekly.upsert({
          where: { guestId_seasonId: { guestId, seasonId: activeSeason.id } },
          create: { guestId, seasonId: activeSeason.id, bestScore: score },
          update: { bestScore: score },
        });
        await this.redisRankingService.updateScore(
          this.redisRankingService.getWeeklyKey(activeSeason.id),
          guestId,
          score,
        );
      }
    });
  }
}
