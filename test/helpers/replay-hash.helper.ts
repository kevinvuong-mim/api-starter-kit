import { computeReplayHash } from '@/modules/game/game-replay-hmac.util';

export const PUZZLE_QUEST_SECRET = 'puzzle-quest-dev-secret';

export function buildValidReplayHash(
  gameId: string,
  score: number,
  runSeed: string,
  secret = PUZZLE_QUEST_SECRET,
): string {
  return computeReplayHash(secret, gameId, score, runSeed);
}
