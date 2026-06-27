export const APP_CONFIG = {
  sessionTokenTtlDays: Number(process.env.SESSION_TOKEN_TTL_DAYS ?? 90),
  gameResultsRetentionMonths: Number(process.env.GAME_RESULTS_RETENTION_MONTHS ?? 36),
} as const;
