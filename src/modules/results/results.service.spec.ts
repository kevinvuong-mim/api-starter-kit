import { GameId } from '@/common/constants';
import { buildReplayPayload, computeReplaySignature } from '@/common/utils';
import { ResultsService } from '@/modules/results/results.service';

describe('ResultsService', () => {
  const secret = 'b'.repeat(64);

  const resultsRepository = {
    findExistingClientResultIds: jest.fn().mockResolvedValue([]),
    insertResults: jest.fn().mockResolvedValue(1),
    upsertLeaderboardBestScore: jest.fn().mockResolvedValue(1500),
  };

  const redisService = {
    updateLeaderboardScore: jest.fn().mockResolvedValue(undefined),
  };

  const service = new ResultsService(resultsRepository as never, redisService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REPLAY_SECRET_FRULOOP = secret;
  });

  it('submits valid signed results', async () => {
    const item = {
      clientResultId: 'res-001',
      score: 1500,
      playedAt: '2026-01-15T10:00:00.000Z',
      metadata: { level: 5 },
      signature: '',
    };

    item.signature = computeReplaySignature(
      secret,
      buildReplayPayload({
        gameId: GameId.FRULOOP,
        guestId: 'guest-1',
        clientResultId: item.clientResultId,
        score: item.score,
        playedAt: item.playedAt,
      }),
    );

    const response = await service.submitResults(
      GameId.FRULOOP,
      { guestId: 'guest-1', gameId: GameId.FRULOOP },
      { items: [item] },
    );

    expect(response).toEqual({
      success: true,
      insertedCount: 1,
      message: 'Results submitted',
    });
    expect(redisService.updateLeaderboardScore).toHaveBeenCalledWith(
      GameId.FRULOOP,
      'guest-1',
      1500,
    );
  });
});
