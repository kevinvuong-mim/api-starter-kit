import { registerAs } from '@nestjs/config';

export const GAME_CONFIG_KEY = 'game';

export interface GameConfig {
  maxScore: number;
  minDurationSeconds: number;
  maxActionsPerSecond: number;
  trustPenalty: number;
  shadowThreshold: number;
  blockedThreshold: number;
  maxSeed: number;
  leaderboardTopLimit: number;
  nearbyRankRange: number;
}

export default registerAs(
  GAME_CONFIG_KEY,
  (): GameConfig => ({
    maxScore: Number(process.env.GAME_MAX_SCORE ?? 1_000_000),
    minDurationSeconds: Number(process.env.GAME_MIN_DURATION_SECONDS ?? 5),
    maxActionsPerSecond: Number(process.env.GAME_MAX_ACTIONS_PER_SECOND ?? 10),
    trustPenalty: Number(process.env.GAME_TRUST_PENALTY ?? 20),
    shadowThreshold: Number(process.env.GAME_SHADOW_THRESHOLD ?? 60),
    blockedThreshold: Number(process.env.GAME_BLOCKED_THRESHOLD ?? 20),
    maxSeed: Number(process.env.GAME_MAX_SEED ?? 2_147_483_647),
    leaderboardTopLimit: Number(process.env.GAME_LEADERBOARD_TOP_LIMIT ?? 100),
    nearbyRankRange: Number(process.env.GAME_NEARBY_RANK_RANGE ?? 2),
  }),
);
