import { registerAs } from '@nestjs/config';

export const GAME_CONFIG_KEY = 'game';

export interface GameConfig {
  leaderboardTopLimit: number;
}

export default registerAs(
  GAME_CONFIG_KEY,
  (): GameConfig => ({
    leaderboardTopLimit: Number(process.env.GAME_LEADERBOARD_TOP_LIMIT ?? 100),
  }),
);
