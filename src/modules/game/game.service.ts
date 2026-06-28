import { Injectable, Logger } from '@nestjs/common';

import { GameRepository } from '@/modules/game/game.repository';
import { GameResultDto } from '@/modules/game/dto/sync-game-results.dto';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { validateGameResult } from '@/modules/game/game-result.validation';
import {
  SyncGameResultItemResponseDto,
  SyncGameResultsResponseDto,
} from '@/modules/game/dto/sync-game-results-response.dto';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly gameRegistryService: GameRegistryService,
    private readonly redisRankingService: RedisRankingService,
  ) {}

  async syncResults(
    gameId: string,
    guestId: string,
    results: GameResultDto[],
  ): Promise<SyncGameResultsResponseDto> {
    const game = await this.gameRegistryService.assertGameExists(gameId);
    const config = this.gameRegistryService.getConfig(game);

    const replayHashes = results.map((result) => result.replayHash);
    const existingRows = await this.gameRepository.findReplayResults(gameId, replayHashes);
    const existingByHash = new Map(existingRows.map((row) => [row.replayHash, row]));

    const responseByHash = new Map<string, SyncGameResultItemResponseDto>();
    const toInsert: GameResultDto[] = [];
    const seenInBatch = new Map<string, { guestId: string; score: number }>();

    for (const result of results) {
      const existing = existingByHash.get(result.replayHash);
      const batchOwner = seenInBatch.get(result.replayHash);
      const owner = existing ?? batchOwner ?? null;

      const validation = validateGameResult(gameId, guestId, result, config, owner);
      if (!validation.valid) {
        responseByHash.set(result.replayHash, {
          replayHash: result.replayHash,
          status: 'rejected',
          reason: validation.reason,
        });
        continue;
      }

      if (owner) {
        responseByHash.set(result.replayHash, {
          replayHash: result.replayHash,
          status: 'accepted',
        });
        continue;
      }

      toInsert.push(result);
      seenInBatch.set(result.replayHash, { guestId, score: result.score });
    }

    let hasInserted = false;
    if (toInsert.length > 0) {
      const inserted = await this.gameRepository.insertResultsBatch(gameId, guestId, toInsert);
      hasInserted = inserted.length > 0;

      for (const result of toInsert) {
        responseByHash.set(result.replayHash, {
          replayHash: result.replayHash,
          status: 'accepted',
        });
      }
    }

    const itemResponses = results.map((result) => responseByHash.get(result.replayHash)!);
    const accepted = itemResponses.filter((item) => item.status === 'accepted').length;
    const rejected = itemResponses.filter((item) => item.status === 'rejected').length;
    const bestScore = await this.gameRepository.getBestScoreForGuest(gameId, guestId);

    if (rejected > 0) {
      this.logger.warn('Rejected game result sync items', {
        gameId,
        guestId,
        accepted,
        rejected,
        reasons: itemResponses
          .filter((item) => item.status === 'rejected')
          .map((item) => item.reason),
      });
    }

    this.logAcceptedResultAnomalies(gameId, guestId, results, itemResponses, config);

    // Push the guest's authoritative best score (post-GREATEST in PG) to Redis exactly once.
    // The Lua script only raises an existing score, so this stays consistent even on retries.
    if (hasInserted && bestScore > 0) {
      const redisKey = this.redisRankingService.getGlobalKey(gameId);
      await this.redisRankingService.updateScore(redisKey, guestId, bestScore);
    }

    return { results: itemResponses, accepted, rejected, bestScore };
  }

  private logAcceptedResultAnomalies(
    gameId: string,
    guestId: string,
    results: GameResultDto[],
    itemResponses: SyncGameResultItemResponseDto[],
    config: ReturnType<GameRegistryService['getConfig']>,
  ): void {
    if (!config.minDurationMs && !config.maxScorePerMinute) {
      return;
    }

    for (let index = 0; index < results.length; index += 1) {
      if (itemResponses[index]?.status !== 'accepted') {
        continue;
      }

      const result = results[index];
      const durationSeconds =
        typeof result.metadata?.duration === 'number' && Number.isFinite(result.metadata.duration)
          ? result.metadata.duration
          : undefined;
      const reasons: string[] = [];

      if (
        config.minDurationMs &&
        durationSeconds &&
        durationSeconds * 1000 < config.minDurationMs
      ) {
        reasons.push('MIN_DURATION');
      }

      if (config.maxScorePerMinute && durationSeconds && durationSeconds > 0) {
        const scorePerMinute = (result.score / durationSeconds) * 60;
        if (scorePerMinute > config.maxScorePerMinute) {
          reasons.push('SCORE_RATE');
        }
      }

      if (reasons.length > 0) {
        this.logger.warn('Accepted result matched anomaly policy', {
          gameId,
          guestId,
          score: result.score,
          replayHash: result.replayHash,
          reasons,
        });
      }
    }
  }
}
