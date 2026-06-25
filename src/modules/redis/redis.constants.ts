export const REDIS_CLIENT = 'REDIS_CLIENT';

export const REDIS_KEYS = {
  global: 'lb:global',
  weekly: (seasonId: string) => `lb:weekly:${seasonId}`,
} as const;

export interface LeaderboardEntry {
  guestId: string;
  score: number;
  rank: number;
}

export interface NearbyRanksResult {
  rank: number;
  score: number;
  nearby: LeaderboardEntry[];
}
