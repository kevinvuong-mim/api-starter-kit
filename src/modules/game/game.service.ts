import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';

import { GuestService } from '@/modules/guest/guest.service';
import { GameRepository } from '@/modules/game/game.repository';
import { ReplayService } from '@/modules/replay/replay.service';
import { GameResultDto } from '@/modules/game/dto/sync-game-results.dto';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { SyncGameResultsResponseDto } from '@/modules/game/dto/sync-game-results-response.dto';

@Injectable()
export class GameService {
  constructor(
    private readonly guestService: GuestService,
    private readonly replayService: ReplayService,
    private readonly gameRepository: GameRepository,
    private readonly gameRegistryService: GameRegistryService,
    private readonly redisRankingService: RedisRankingService,
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

      try {
        await this.gameRepository.createResult(gameId, guestId, result);
      } catch (error) {
        // Race condition: một request đồng thời đã insert cùng replayHash.
        // Unique constraint [gameId, replayHash] đảm bảo idempotency -> xử lý theo chủ sở hữu.
        if (this.isUniqueConstraintError(error)) {
          const existing = await this.gameRepository.findByReplayHash(gameId, result.replayHash);
          if (existing?.guestId === guestId) {
            accepted += 1;
          } else {
            rejected += 1;
          }
          continue;
        }
        throw error;
      }

      await this.updateLeaderboards(gameId, guestId, result.score);
      accepted += 1;
    }

    const bestScore = await this.gameRepository.getBestScoreForGuest(gameId, guestId);

    return { accepted, rejected, bestScore };
  }

  private async updateLeaderboards(gameId: string, guestId: string, score: number): Promise<void> {
    // Postgres là source of truth (atomic upsert giữ best score).
    // Redis cập nhật sau khi DB ghi thành công; nếu Redis lỗi sẽ được cron rebuild đồng bộ lại,
    // nên không gộp Redis vào transaction của Postgres (hai hệ thống không transactional với nhau).
    await this.gameRepository.upsertLeaderboardBest(gameId, guestId, score);
    await this.redisRankingService.updateScore(
      this.redisRankingService.getGlobalKey(gameId),
      guestId,
      score,
    );
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
