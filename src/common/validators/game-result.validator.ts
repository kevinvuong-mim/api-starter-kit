import { ParsedGameConfig } from '@/common/validators';
import { verifyReplayHash, RUN_SEED_METADATA_KEY } from '@/common/utils';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export enum ResultRejectionReason {
  SCORE_RATE = 'SCORE_RATE',
  MIN_DURATION = 'MIN_DURATION',
  SCORE_MISMATCH = 'SCORE_MISMATCH',
  DUPLICATE_REPLAY = 'DUPLICATE_REPLAY',
  MISSING_RUN_SEED = 'MISSING_RUN_SEED',
  INVALID_PLAYED_AT = 'INVALID_PLAYED_AT',
  MISSING_REPLAY_HASH = 'MISSING_REPLAY_HASH',
  INVALID_REPLAY_SIGNATURE = 'INVALID_REPLAY_SIGNATURE',
  INVALID_REPLAY_HASH_FORMAT = 'INVALID_REPLAY_HASH_FORMAT',
}

export interface GameResultInput {
  score: number;
  playedAt?: string;
  replayHash: string;
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

export function validatePlayedAt(playedAt: string | undefined): ResultValidationOutcome {
  if (!playedAt) {
    return { valid: true };
  }

  const date = new Date(playedAt);
  if (Number.isNaN(date.getTime())) {
    return { valid: false, reason: ResultRejectionReason.INVALID_PLAYED_AT };
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

  const playedAtResult = validatePlayedAt(input.playedAt);
  if (!playedAtResult.valid) {
    return playedAtResult;
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
