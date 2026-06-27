export const APP_CONFIG = {
  sessionTokenTtlDays: Number(process.env.SESSION_TOKEN_TTL_DAYS ?? 90),
  gameResultsRetentionMonths: Number(process.env.GAME_RESULTS_RETENTION_MONTHS ?? 36),
  replayKeyRetentionMonths: Number(process.env.REPLAY_KEY_RETENTION_MONTHS ?? 36),
  replayKeyRetentionBatchSize: Number(process.env.REPLAY_KEY_RETENTION_BATCH_SIZE ?? 5000),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
} as const;

function parseCorsOrigins(value: string | undefined): string[] | true {
  if (!value || value.trim().length === 0) {
    return process.env.NODE_ENV === 'production' ? [] : true;
  }

  if (value.trim() === '*') {
    return true;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
