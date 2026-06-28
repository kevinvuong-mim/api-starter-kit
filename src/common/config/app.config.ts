export const APP_CONFIG = {
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
