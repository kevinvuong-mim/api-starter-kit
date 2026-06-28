import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  validateGameResult,
  validatePlayedAt,
  ResultRejectionReason,
} from '@/modules/game/game-result.validation';
import { computeReplayHash } from '@/modules/game/game-replay-hmac.util';
import { parseGameConfig } from '@/modules/game/game-config.validator';

interface ReplayHashVector {
  name: string;
  gameId: string;
  score: number;
  runSeed: string;
  replayHash: string;
  replaySecret: string;
}

function readContractJson<T>(fileName: string): T {
  const repoLocalPath = resolve(process.cwd(), 'contracts', fileName);
  const workspacePath = resolve(process.cwd(), '..', 'contracts', fileName);
  const contractPath = existsSync(repoLocalPath) ? repoLocalPath : workspacePath;

  return JSON.parse(readFileSync(contractPath, 'utf8')) as T;
}

describe('game-result.validation', () => {
  const gameId = 'puzzle-quest';
  const guestId = 'guest-1';
  const config = parseGameConfig({
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

  it('rejects invalid playedAt values', () => {
    expect(validatePlayedAt('not-a-date')).toEqual({
      valid: false,
      reason: ResultRejectionReason.INVALID_PLAYED_AT,
    });
  });

  it('accepts valid playedAt values regardless of age', () => {
    const offlinePlay = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const futurePlay = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(validatePlayedAt(offlinePlay)).toEqual({ valid: true });
    expect(validatePlayedAt(futurePlay)).toEqual({ valid: true });
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

  it('keeps anomaly rules log-only by default', () => {
    const runSeed = 'short-run-log-only';
    const score = 1000;
    const replayHash = computeReplayHash('test-secret', gameId, score, runSeed);
    const logOnlyConfig = parseGameConfig({
      replaySecret: 'test-secret',
      minDurationMs: 10_000,
    });

    const result = validateGameResult(
      gameId,
      guestId,
      { score, replayHash, metadata: { runSeed, duration: 1 } },
      logOnlyConfig,
      null,
    );

    expect(result.valid).toBe(true);
  });

  it('rejects anomaly policy violations when configured', () => {
    const runSeed = 'short-run-reject';
    const score = 1000;
    const replayHash = computeReplayHash('test-secret', gameId, score, runSeed);
    const rejectConfig = parseGameConfig({
      replaySecret: 'test-secret',
      minDurationMs: 10_000,
      anomalyMode: 'reject',
    });

    const result = validateGameResult(
      gameId,
      guestId,
      { score, replayHash, metadata: { runSeed, duration: 1 } },
      rejectConfig,
      null,
    );

    expect(result).toEqual({ valid: false, reason: ResultRejectionReason.MIN_DURATION });
  });

  it('matches shared replay hash contract vectors', () => {
    const vectors = readContractJson<ReplayHashVector[]>('replay-hash-vectors.json');

    for (const vector of vectors) {
      expect(
        computeReplayHash(vector.replaySecret, vector.gameId, vector.score, vector.runSeed),
      ).toBe(vector.replayHash);
    }
  });

  it('keeps rejection reasons aligned with the shared contract', () => {
    const reasons = readContractJson<string[]>('sync-rejection-reasons.json');

    expect(Object.values(ResultRejectionReason).sort()).toEqual([...reasons].sort());
  });
});
