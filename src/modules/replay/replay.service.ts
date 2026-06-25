import { Injectable } from '@nestjs/common';

import {
  ReplayViolation,
  ReplayValidationInput,
  ReplayValidationResult,
} from '@/modules/replay/replay.types';
import { PrismaService } from '@/modules/prisma/prisma.service';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

@Injectable()
export class ReplayService {
  constructor(private readonly prisma: PrismaService) {}

  validateFormat(replayHash: string): ReplayValidationResult {
    if (!replayHash || replayHash.trim().length === 0) {
      return {
        valid: false,
        message: 'Replay hash is required',
        violation: ReplayViolation.MISSING_REPLAY_HASH,
      };
    }

    if (!SHA256_HEX_PATTERN.test(replayHash)) {
      return {
        valid: false,
        violation: ReplayViolation.INVALID_REPLAY_HASH_FORMAT,
        message: 'Replay hash must be a 64-character SHA-256 hex string',
      };
    }

    return { valid: true };
  }

  async validate(
    gameId: string,
    guestId: string,
    input: ReplayValidationInput,
  ): Promise<ReplayValidationResult> {
    const formatResult = this.validateFormat(input.replayHash);
    if (!formatResult.valid) {
      return formatResult;
    }

    const duplicate = await this.prisma.gameResult.findUnique({
      where: {
        gameId_replayHash: {
          gameId,
          replayHash: input.replayHash,
        },
      },
      select: { id: true, guestId: true },
    });

    if (duplicate && duplicate.guestId !== guestId) {
      return {
        valid: false,
        violation: ReplayViolation.DUPLICATE_REPLAY,
        message: 'Replay hash already used by another player',
      };
    }

    return { valid: true };
  }
}
