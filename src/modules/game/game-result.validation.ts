import { isScoreWithinMax, ParsedGameConfig } from '@/modules/game/game-config.validator';
import { RUN_SEED_METADATA_KEY, verifyReplayHash } from '@/modules/game/game-replay-hmac.util';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export enum ResultRejectionReason {
  DUPLICATE_REPLAY = 'DUPLICATE_REPLAY',
  MISSING_REPLAY_HASH = 'MISSING_REPLAY_HASH',
  INVALID_REPLAY_HASH_FORMAT = 'INVALID_REPLAY_HASH_FORMAT',
  INVALID_REPLAY_SIGNATURE = 'INVALID_REPLAY_SIGNATURE',
  MISSING_RUN_SEED = 'MISSING_RUN_SEED',
  SCORE_EXCEEDS_MAX = 'SCORE_EXCEEDS_MAX',
  SCORE_MISMATCH = 'SCORE_MISMATCH',
  INVALID_PLAYED_AT = 'INVALID_PLAYED_AT',
  PLAYED_AT_IN_FUTURE = 'PLAYED_AT_IN_FUTURE',
  PLAYED_AT_TOO_OLD = 'PLAYED_AT_TOO_OLD',
  MIN_DURATION = 'MIN_DURATION',
  SCORE_RATE = 'SCORE_RATE',
}

export interface GameResultInput {
  score: number;
  replayHash: string;
  playedAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ResultValidationOutcome {
  valid: boolean;
  reason?: ResultRejectionReason;
}

export function validateReplayHashFormat(replayHash: string): ResultValidationOutcome {
  if (!replayHash || replayHash.trim().length === 0) {
    return { valid: false, reason: ResultRejectionReason.MISSING_REPLAY_HASH };
  }

  if (!SHA256_HEX_PATTERN.test(replayHash)) {
    return { valid: false, reason: ResultRejectionReason.INVALID_REPLAY_HASH_FORMAT };
  }

  return { valid: true };
}

export function validatePlayedAt(
  playedAt: string | undefined,
  config: Pick<ParsedGameConfig, 'playedAtMaxAgeDays' | 'playedAtFutureSkewMs'>,
): ResultValidationOutcome {
  if (!playedAt) {
    return { valid: true };
  }

  const date = new Date(playedAt);
  if (Number.isNaN(date.getTime())) {
    return { valid: false, reason: ResultRejectionReason.INVALID_PLAYED_AT };
  }

  const now = Date.now();
  if (date.getTime() > now + config.playedAtFutureSkewMs) {
    return { valid: false, reason: ResultRejectionReason.PLAYED_AT_IN_FUTURE };
  }

  const maxAgeMs = config.playedAtMaxAgeDays * 24 * 60 * 60 * 1000;
  if (date.getTime() < now - maxAgeMs) {
    return { valid: false, reason: ResultRejectionReason.PLAYED_AT_TOO_OLD };
  }

  return { valid: true };
}

export function validateReplaySignature(
  gameId: string,
  input: GameResultInput,
  replaySecret: string | undefined,
): ResultValidationOutcome {
  if (!replaySecret) {
    return { valid: true };
  }

  const runSeed = input.metadata?.[RUN_SEED_METADATA_KEY];
  if (typeof runSeed !== 'string' || runSeed.trim().length === 0) {
    return { valid: false, reason: ResultRejectionReason.MISSING_RUN_SEED };
  }

  if (!verifyReplayHash(replaySecret, gameId, input.score, runSeed, input.replayHash)) {
    return { valid: false, reason: ResultRejectionReason.INVALID_REPLAY_SIGNATURE };
  }

  return { valid: true };
}

export function validateAnomalyPolicy(
  input: GameResultInput,
  config: Pick<ParsedGameConfig, 'anomalyMode' | 'minDurationMs' | 'maxScorePerMinute'>,
): ResultValidationOutcome {
  if (config.anomalyMode !== 'reject') {
    return { valid: true };
  }

  const durationSeconds =
    typeof input.metadata?.duration === 'number' && Number.isFinite(input.metadata.duration)
      ? input.metadata.duration
      : undefined;

  if (!durationSeconds || durationSeconds <= 0) {
    return { valid: true };
  }

  if (config.minDurationMs && durationSeconds * 1000 < config.minDurationMs) {
    return { valid: false, reason: ResultRejectionReason.MIN_DURATION };
  }

  if (config.maxScorePerMinute) {
    const scorePerMinute = (input.score / durationSeconds) * 60;
    if (scorePerMinute > config.maxScorePerMinute) {
      return { valid: false, reason: ResultRejectionReason.SCORE_RATE };
    }
  }

  return { valid: true };
}

export function validateGameResult(
  gameId: string,
  guestId: string,
  input: GameResultInput,
  config: ParsedGameConfig,
  existing?: { guestId: string; score: number } | null,
): ResultValidationOutcome {
  const formatResult = validateReplayHashFormat(input.replayHash);
  if (!formatResult.valid) {
    return formatResult;
  }

  const playedAtResult = validatePlayedAt(input.playedAt, config);
  if (!playedAtResult.valid) {
    return playedAtResult;
  }

  if (!isScoreWithinMax(input.score, config.maxScore)) {
    return { valid: false, reason: ResultRejectionReason.SCORE_EXCEEDS_MAX };
  }

  const signatureResult = validateReplaySignature(gameId, input, config.replaySecret);
  if (!signatureResult.valid) {
    return signatureResult;
  }

  const anomalyResult = validateAnomalyPolicy(input, config);
  if (!anomalyResult.valid) {
    return anomalyResult;
  }

  if (existing) {
    if (existing.guestId !== guestId) {
      return { valid: false, reason: ResultRejectionReason.DUPLICATE_REPLAY };
    }

    if (existing.score !== input.score) {
      return { valid: false, reason: ResultRejectionReason.SCORE_MISMATCH };
    }
  }

  return { valid: true };
}
