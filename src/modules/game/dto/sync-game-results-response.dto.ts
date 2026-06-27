import { ResultRejectionReason } from '@/modules/game/game-result.validation';

export type SyncResultStatus = 'accepted' | 'rejected';

export class SyncGameResultItemResponseDto {
  replayHash!: string;
  status!: SyncResultStatus;
  reason?: ResultRejectionReason;
}

export class SyncGameResultsResponseDto {
  results!: SyncGameResultItemResponseDto[];
  accepted!: number;
  rejected!: number;
  bestScore!: number;
}
