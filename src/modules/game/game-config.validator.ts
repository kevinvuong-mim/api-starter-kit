import { Prisma } from '@prisma/client';

export interface ParsedGameConfig {
  anomalyMode: 'log' | 'reject';
  minDurationMs?: number;
  maxScorePerMinute?: number;
  replaySecret?: string;
}

export function parseGameConfig(config: Prisma.JsonValue): ParsedGameConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {
      anomalyMode: 'log',
    };
  }

  const record = config as Record<string, unknown>;
  const rawMinDurationMs = record.minDurationMs;
  const rawMaxScorePerMinute = record.maxScorePerMinute;
  const rawReplaySecret = record.replaySecret;
  const rawAnomalyMode = record.anomalyMode;

  return {
    anomalyMode: rawAnomalyMode === 'reject' ? 'reject' : 'log',
    minDurationMs:
      typeof rawMinDurationMs === 'number' &&
      Number.isFinite(rawMinDurationMs) &&
      rawMinDurationMs > 0
        ? Math.floor(rawMinDurationMs)
        : undefined,
    maxScorePerMinute:
      typeof rawMaxScorePerMinute === 'number' &&
      Number.isFinite(rawMaxScorePerMinute) &&
      rawMaxScorePerMinute > 0
        ? Math.floor(rawMaxScorePerMinute)
        : undefined,
    replaySecret:
      typeof rawReplaySecret === 'string' && rawReplaySecret.length > 0
        ? rawReplaySecret
        : undefined,
  };
}
