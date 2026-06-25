export enum AntiCheatViolation {
  IMPOSSIBLE_SCORE = 'IMPOSSIBLE_SCORE',
  DURATION_TOO_SHORT = 'DURATION_TOO_SHORT',
  TOO_MANY_ACTIONS = 'TOO_MANY_ACTIONS',
  INVALID_REPLAY_HASH = 'INVALID_REPLAY_HASH',
  INVALID_SEED = 'INVALID_SEED',
  DUPLICATE_REPLAY = 'DUPLICATE_REPLAY',
}

export interface GameResultInput {
  score: number;
  duration: number;
  seed: number;
  moves: unknown[];
  replayHash: string;
  clientVersion?: string;
}

export interface AntiCheatResult {
  valid: boolean;
  violation?: AntiCheatViolation;
  message?: string;
}
