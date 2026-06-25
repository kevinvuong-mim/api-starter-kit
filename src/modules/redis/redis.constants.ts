export const REDIS_CLIENT = 'REDIS_CLIENT';

export const REDIS_KEYS = {
  global: (gameId: string) => `lb:global:${gameId}`,
} as const;

export interface LeaderboardEntry {
  guestId: string;
  score: number;
  rank: number;
}
