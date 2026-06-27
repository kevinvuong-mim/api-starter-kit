import { Prisma } from '@prisma/client';

export const DEFAULT_MAX_SCORE = 100_000;
export const DEFAULT_PLAYED_AT_MAX_AGE_DAYS = 7;
export const DEFAULT_PLAYED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface ParsedGameConfig {
  maxScore: number;
  replaySecret?: string;
  playedAtMaxAgeDays: number;
  playedAtFutureSkewMs: number;
}

export function parseGameConfig(config: Prisma.JsonValue): ParsedGameConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {
      maxScore: DEFAULT_MAX_SCORE,
      playedAtMaxAgeDays: DEFAULT_PLAYED_AT_MAX_AGE_DAYS,
      playedAtFutureSkewMs: DEFAULT_PLAYED_AT_FUTURE_SKEW_MS,
    };
  }

  const record = config as Record<string, unknown>;
  const rawMaxScore = record.maxScore;
  const rawReplaySecret = record.replaySecret;
  const rawPlayedAtMaxAgeDays = record.playedAtMaxAgeDays;
  const rawPlayedAtFutureSkewMs = record.playedAtFutureSkewMs;

  let maxScore = DEFAULT_MAX_SCORE;
  if (typeof rawMaxScore === 'number' && Number.isFinite(rawMaxScore) && rawMaxScore > 0) {
    maxScore = Math.floor(rawMaxScore);
  }

  let playedAtMaxAgeDays = DEFAULT_PLAYED_AT_MAX_AGE_DAYS;
  if (
    typeof rawPlayedAtMaxAgeDays === 'number' &&
    Number.isFinite(rawPlayedAtMaxAgeDays) &&
    rawPlayedAtMaxAgeDays > 0
  ) {
    playedAtMaxAgeDays = Math.floor(rawPlayedAtMaxAgeDays);
  }

  let playedAtFutureSkewMs = DEFAULT_PLAYED_AT_FUTURE_SKEW_MS;
  if (
    typeof rawPlayedAtFutureSkewMs === 'number' &&
    Number.isFinite(rawPlayedAtFutureSkewMs) &&
    rawPlayedAtFutureSkewMs >= 0
  ) {
    playedAtFutureSkewMs = Math.floor(rawPlayedAtFutureSkewMs);
  }

  return {
    maxScore,
    playedAtMaxAgeDays,
    playedAtFutureSkewMs,
    replaySecret:
      typeof rawReplaySecret === 'string' && rawReplaySecret.length > 0
        ? rawReplaySecret
        : undefined,
  };
}

export function isScoreWithinMax(score: number, maxScore: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= maxScore;
}
