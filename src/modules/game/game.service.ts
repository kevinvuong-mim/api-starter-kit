import { Injectable } from '@nestjs/common';

import { GameRepository } from '@/modules/game/game.repository';
import { GameResultDto } from '@/modules/game/dto/sync-game-results.dto';
import { GameRegistryService } from '@/modules/game/game-registry.service';
import { RedisRankingService } from '@/modules/redis/redis-ranking.service';
import { validateGameResult, ResultRejectionReason } from '@/modules/game/game-result.validation';
import {
  SyncGameResultItemResponseDto,
  SyncGameResultsResponseDto,
} from '@/modules/game/dto/sync-game-results-response.dto';

@Injectable()
export class GameService {
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
    const game = await this.gameRegistryService.assertActiveGame(gameId);
    const config = this.gameRegistryService.getConfig(game);

    const replayHashes = results.map((result) => result.replayHash);
    const existingRows = await this.gameRepository.findReplayKeys(gameId, replayHashes);
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
      const insertedByHash = new Set(inserted.map((row) => row.replayHash));
      hasInserted = inserted.length > 0;

      // Rows that lost an INSERT ... ON CONFLICT race need their real owner re-read so a
      // concurrent retry from the same guest+score is treated as idempotent (accepted),
      // not blindly rejected as a duplicate.
      const conflictedHashes = toInsert
        .filter((result) => !insertedByHash.has(result.replayHash))
        .map((result) => result.replayHash);

      const conflictByHash = new Map(
        conflictedHashes.length > 0
          ? (await this.gameRepository.findReplayKeys(gameId, conflictedHashes)).map((row) => [
              row.replayHash,
              row,
            ])
          : [],
      );

      for (const result of toInsert) {
        if (insertedByHash.has(result.replayHash)) {
          responseByHash.set(result.replayHash, {
            replayHash: result.replayHash,
            status: 'accepted',
          });
          continue;
        }

        responseByHash.set(
          result.replayHash,
          this.resolveConflictOutcome(result, guestId, conflictByHash.get(result.replayHash)),
        );
      }
    }

    const itemResponses = results.map((result) => responseByHash.get(result.replayHash)!);
    const accepted = itemResponses.filter((item) => item.status === 'accepted').length;
    const rejected = itemResponses.filter((item) => item.status === 'rejected').length;
    const bestScore = await this.gameRepository.getBestScoreForGuest(gameId, guestId);

    // Push the guest's authoritative best score (post-GREATEST in PG) to Redis exactly once.
    // The Lua script only raises an existing score, so this stays consistent even on retries.
    if (hasInserted && bestScore > 0) {
      const redisKey = this.redisRankingService.getGlobalKey(gameId);
      await this.redisRankingService.updateScore(redisKey, guestId, bestScore);
    }

    return { results: itemResponses, accepted, rejected, bestScore };
  }

  private resolveConflictOutcome(
    result: GameResultDto,
    guestId: string,
    conflict: { guestId: string; score: number } | undefined,
  ): SyncGameResultItemResponseDto {
    if (conflict && conflict.guestId === guestId && conflict.score === result.score) {
      return { replayHash: result.replayHash, status: 'accepted' };
    }

    if (conflict && conflict.guestId === guestId && conflict.score !== result.score) {
      return {
        replayHash: result.replayHash,
        status: 'rejected',
        reason: ResultRejectionReason.SCORE_MISMATCH,
      };
    }

    return {
      replayHash: result.replayHash,
      status: 'rejected',
      reason: ResultRejectionReason.DUPLICATE_REPLAY,
    };
  }
}
