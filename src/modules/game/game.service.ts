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

    const replayHashes = results.map((result) => result.replayHash);
    const existingRows = await this.gameRepository.findByReplayHashes(gameId, replayHashes);
    const existingByHash = new Map(existingRows.map((row) => [row.replayHash, row]));

    let accepted = 0;
    let rejected = 0;
    const toInsert: GameResultDto[] = [];
    const seenInBatch = new Map<string, string>();

    for (const result of results) {
      const existing = existingByHash.get(result.replayHash);
      const batchOwner = seenInBatch.get(result.replayHash);

      if (existing || batchOwner) {
        const ownerGuestId = existing?.guestId ?? batchOwner!;
        if (ownerGuestId === guestId) {
          accepted += 1;
        } else {
          rejected += 1;
        }
        continue;
      }

      const validation = this.replayService.validateAgainstExisting(guestId, result, null);
      if (!validation.valid) {
        rejected += 1;
        continue;
      }

      toInsert.push(result);
      seenInBatch.set(result.replayHash, guestId);
    }

    if (toInsert.length > 0) {
      const inserted = await this.gameRepository.insertResultsBatch(gameId, guestId, toInsert);
      const insertedByHash = new Map(inserted.map((row) => [row.replayHash, row]));

      for (const result of toInsert) {
        const row = insertedByHash.get(result.replayHash);
        if (row) {
          accepted += 1;
        } else {
          rejected += 1;
        }
      }

      const redisKey = this.redisRankingService.getGlobalKey(gameId);
      await Promise.all(
        inserted.map((row) => this.redisRankingService.updateScore(redisKey, guestId, row.score)),
      );
    }

    const bestScore = await this.gameRepository.getBestScoreForGuest(gameId, guestId);

    return { accepted, rejected, bestScore };
  }
}
