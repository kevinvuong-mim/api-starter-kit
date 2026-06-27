import { GameService } from '@/modules/game/game.service';
import { computeReplayHash } from '@/modules/game/game-replay-hmac.util';
import { ParsedGameConfig } from '@/modules/game/game-config.validator';

describe('GameService', () => {
  const gameId = 'puzzle-quest';
  const guestId = 'guest-1';
  const config: ParsedGameConfig = {
    maxScore: 50000,
    anomalyMode: 'log',
    replaySecret: 'test-secret',
    playedAtMaxAgeDays: 30,
    playedAtFutureSkewMs: 5 * 60 * 1000,
  };

  function buildService(
    overrides: {
      findReplayKeys?: jest.Mock;
      insertResultsBatch?: jest.Mock;
      getBestScoreForGuest?: jest.Mock;
      updateScore?: jest.Mock;
    } = {},
  ) {
    const gameRepository = {
      findReplayKeys: overrides.findReplayKeys ?? jest.fn().mockResolvedValue([]),
      insertResultsBatch: overrides.insertResultsBatch ?? jest.fn().mockResolvedValue([]),
      getBestScoreForGuest: overrides.getBestScoreForGuest ?? jest.fn().mockResolvedValue(0),
    };
    const gameRegistryService = {
      assertActiveGame: jest.fn().mockResolvedValue({ id: gameId, config }),
      getConfig: jest.fn().mockReturnValue(config),
    };
    const redisRankingService = {
      getGlobalKey: jest.fn().mockReturnValue(`lb:global:${gameId}`),
      updateScore: overrides.updateScore ?? jest.fn().mockResolvedValue(undefined),
    };

    return {
      gameRepository,
      gameRegistryService,
      redisRankingService,
      service: new GameService(
        gameRepository as never,
        gameRegistryService as never,
        redisRankingService as never,
      ),
    };
  }

  it('accepts idempotent retries from the same guest and score without inserting again', async () => {
    const score = 1500;
    const runSeed = 'run-1';
    const replayHash = computeReplayHash(config.replaySecret!, gameId, score, runSeed);
    const { gameRepository, service } = buildService({
      findReplayKeys: jest.fn().mockResolvedValue([{ gameId, guestId, replayHash, score }]),
      getBestScoreForGuest: jest.fn().mockResolvedValue(score),
    });

    await expect(
      service.syncResults(gameId, guestId, [{ score, replayHash, metadata: { runSeed } }]),
    ).resolves.toMatchObject({
      accepted: 1,
      rejected: 0,
      bestScore: score,
      results: [{ replayHash, status: 'accepted' }],
    });
    expect(gameRepository.insertResultsBatch).not.toHaveBeenCalled();
  });

  it('updates Redis once when new accepted results raise the best score', async () => {
    const score = 2000;
    const runSeed = 'run-2';
    const replayHash = computeReplayHash(config.replaySecret!, gameId, score, runSeed);
    const updateScore = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({
      insertResultsBatch: jest.fn().mockResolvedValue([{ guestId, replayHash, score }]),
      getBestScoreForGuest: jest.fn().mockResolvedValue(score),
      updateScore,
    });

    await expect(
      service.syncResults(gameId, guestId, [{ score, replayHash, metadata: { runSeed } }]),
    ).resolves.toMatchObject({
      accepted: 1,
      rejected: 0,
      bestScore: score,
    });
    expect(updateScore).toHaveBeenCalledWith(`lb:global:${gameId}`, guestId, score);
  });
});
