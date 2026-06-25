export enum ReplayViolation {
  DUPLICATE_REPLAY = 'DUPLICATE_REPLAY',
  MISSING_REPLAY_HASH = 'MISSING_REPLAY_HASH',
  INVALID_REPLAY_HASH_FORMAT = 'INVALID_REPLAY_HASH_FORMAT',
}

export interface ReplayValidationInput {
  replayHash: string;
}

export interface ReplayValidationResult {
  valid: boolean;
  message?: string;
  violation?: ReplayViolation;
}
