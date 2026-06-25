export enum ReplayViolation {
  MISSING_REPLAY_HASH = 'MISSING_REPLAY_HASH',
  INVALID_REPLAY_HASH_FORMAT = 'INVALID_REPLAY_HASH_FORMAT',
  DUPLICATE_REPLAY = 'DUPLICATE_REPLAY',
}

export interface ReplayValidationInput {
  replayHash: string;
}

export interface ReplayValidationResult {
  valid: boolean;
  violation?: ReplayViolation;
  message?: string;
}
