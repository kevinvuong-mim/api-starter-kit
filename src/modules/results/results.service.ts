import { ForbiddenException, Injectable } from '@nestjs/common';

import { getGameConfig, validateGameId } from '@/common/constants';
import { buildReplayPayload, verifyReplaySignature } from '@/common/utils';
import type { AuthenticatedGuest } from '@/common/decorators';
import { RedisService } from '@/modules/redis/redis.service';
import { SubmitResultBatchDto } from '@/modules/results/dto/submit-result-batch.dto';
import { ResultsRepository } from '@/modules/results/results.repository';

@Injectable()
export class ResultsService {
  constructor(
    private readonly resultsRepository: ResultsRepository,
    private readonly redisService: RedisService,
  ) {}

  async submitResults(routeGameId: string, guest: AuthenticatedGuest, dto: SubmitResultBatchDto) {
    const gameId = validateGameId(routeGameId);

    if (guest.gameId !== gameId) {
      throw new ForbiddenException('Guest does not belong to this game');
    }

    const replaySecret = getGameConfig(gameId).replaySecret;
    const validItems = dto.items.filter((item) => {
      const payload = buildReplayPayload({
        gameId,
        guestId: guest.guestId,
        clientResultId: item.clientResultId,
        score: item.score,
        playedAt: item.playedAt,
      });

      return verifyReplaySignature(replaySecret, payload, item.signature);
    });

    const existingIds = await this.resultsRepository.findExistingClientResultIds(
      gameId,
      guest.guestId,
      validItems.map((item) => item.clientResultId),
    );
    const existingSet = new Set(existingIds);

    const toInsert = validItems
      .filter((item) => !existingSet.has(item.clientResultId))
      .map((item) => ({
        ...item,
        replayHash: item.signature,
      }));

    const insertedCount = await this.resultsRepository.insertResults(
      gameId,
      guest.guestId,
      toInsert,
    );

    if (insertedCount > 0) {
      const maxScore = Math.max(...toInsert.map((item) => item.score));
      const bestScore = await this.resultsRepository.upsertLeaderboardBestScore(
        gameId,
        guest.guestId,
        maxScore,
      );
      await this.redisService.updateLeaderboardScore(gameId, guest.guestId, bestScore);
    }

    return {
      success: true,
      insertedCount,
      message: 'Results submitted',
    };
  }
}
