import {
  validateGameResult,
  validatePlayedAt,
  ResultRejectionReason,
} from '@/modules/game/game-result.validation';
import { computeReplayHash } from '@/modules/game/game-replay-hmac.util';
import { parseGameConfig } from '@/modules/game/game-config.validator';

describe('game-result.validation', () => {
  const gameId = 'puzzle-quest';
  const guestId = 'guest-1';
  const config = parseGameConfig({
    maxScore: 50000,
    replaySecret: 'test-secret',
  });

  it('accepts valid HMAC replay hash', () => {
    const runSeed = 'run-001';
    const score = 1200;
    const replayHash = computeReplayHash('test-secret', gameId, score, runSeed);

    const result = validateGameResult(
      gameId,
      guestId,
      { score, replayHash, metadata: { runSeed } },
      config,
      null,
    );

    expect(result.valid).toBe(true);
  });

  it('rejects invalid HMAC signature', () => {
    const result = validateGameResult(
      gameId,
      guestId,
      {
        score: 1200,
        replayHash: 'a'.repeat(64),
        metadata: { runSeed: 'run-001' },
      },
      config,
      null,
    );

    expect(result).toEqual({
      valid: false,
      reason: ResultRejectionReason.INVALID_REPLAY_SIGNATURE,
    });
  });

  it('rejects missing runSeed when replaySecret configured', () => {
    const result = validateGameResult(
      gameId,
      guestId,
      { score: 100, replayHash: 'b'.repeat(64) },
      config,
      null,
    );

    expect(result).toEqual({
      valid: false,
      reason: ResultRejectionReason.MISSING_RUN_SEED,
    });
  });

  it('rejects playedAt in the future', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = validatePlayedAt(future, config);
    expect(result).toEqual({
      valid: false,
      reason: ResultRejectionReason.PLAYED_AT_IN_FUTURE,
    });
  });

  it('accepts idempotent duplicate for same guest', () => {
    const runSeed = 'run-dup';
    const score = 500;
    const replayHash = computeReplayHash('test-secret', gameId, score, runSeed);

    const result = validateGameResult(
      gameId,
      guestId,
      { score, replayHash, metadata: { runSeed } },
      config,
      { guestId, score },
    );

    expect(result.valid).toBe(true);
  });
});
