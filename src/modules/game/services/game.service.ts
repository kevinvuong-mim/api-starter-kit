import { Logger, Injectable } from '@nestjs/common';

import { validateGameResult } from '@/common/validators';
import { GameRegistryService } from '@/modules/game/services';
import { RedisRankingService } from '@/modules/redis/services';
import { GameRepository } from '@/modules/game/game.repository';
import { GameResultDto } from '@/modules/game/dto/sync-game-results.dto';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly gameRegistryService: GameRegistryService,
    private readonly redisRankingService: RedisRankingService,
  ) {}

  async syncResults(gameId: string, guestId: string, results: GameResultDto[]) {
    const game = await this.gameRegistryService.assertGameExists(gameId);
    const config = this.gameRegistryService.getConfig(game);

    const replayHashes = results.map((result) => result.replayHash);
    const existingRows = await this.gameRepository.findReplayResults(gameId, replayHashes);
    const existingByHash = new Map(existingRows.map((row) => [row.replayHash, row]));

    const responseByHash = new Map();
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

    // Push the guest's authoritative best score (post-GREATEST in PG) to Redis exactly once.
    // The Lua script only raises an existing score, so this stays consistent even on retries.
    if (hasInserted && bestScore > 0) {
      const redisKey = this.redisRankingService.getGlobalKey(gameId);
      await this.redisRankingService.updateScore(redisKey, guestId, bestScore);
    }

    return { accepted, rejected, bestScore, results: itemResponses };
  }
}
