import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GAME_CONFIG_KEY, GameConfig } from '@/config/game.config';
import { PrismaService } from '@/modules/prisma/prisma.service';
import {
  AntiCheatResult,
  AntiCheatViolation,
  GameResultInput,
} from '@/modules/anti-cheat/anti-cheat.types';

@Injectable()
export class AntiCheatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private get config(): GameConfig {
    return this.configService.get<GameConfig>(GAME_CONFIG_KEY)!;
  }

  computeReplayHash(input: Pick<GameResultInput, 'seed' | 'moves' | 'score' | 'duration'>): string {
    const payload = `${input.seed}:${input.score}:${input.duration}:${JSON.stringify(input.moves)}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  async validate(input: GameResultInput, guestId: string): Promise<AntiCheatResult> {
    if (input.score < 0 || input.score > this.config.maxScore) {
      return {
        valid: false,
        violation: AntiCheatViolation.IMPOSSIBLE_SCORE,
        message: `Score must be between 0 and ${this.config.maxScore}`,
      };
    }

    if (input.duration < this.config.minDurationSeconds) {
      return {
        valid: false,
        violation: AntiCheatViolation.DURATION_TOO_SHORT,
        message: `Duration must be at least ${this.config.minDurationSeconds} seconds`,
      };
    }

    if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > this.config.maxSeed) {
      return {
        valid: false,
        violation: AntiCheatViolation.INVALID_SEED,
        message: 'Seed is out of valid range',
      };
    }

    if (!Array.isArray(input.moves)) {
      return {
        valid: false,
        violation: AntiCheatViolation.TOO_MANY_ACTIONS,
        message: 'Moves must be an array',
      };
    }

    const actionsPerSecond = input.moves.length / input.duration;
    if (actionsPerSecond > this.config.maxActionsPerSecond) {
      return {
        valid: false,
        violation: AntiCheatViolation.TOO_MANY_ACTIONS,
        message: `Actions per second exceeds ${this.config.maxActionsPerSecond}`,
      };
    }

    const expectedHash = this.computeReplayHash(input);
    if (input.replayHash !== expectedHash) {
      return {
        valid: false,
        violation: AntiCheatViolation.INVALID_REPLAY_HASH,
        message: 'Replay hash does not match game data',
      };
    }

    const duplicate = await this.prisma.gameResult.findUnique({
      where: { replayHash: input.replayHash },
      select: { id: true, guestId: true },
    });

    if (duplicate && duplicate.guestId !== guestId) {
      return {
        valid: false,
        violation: AntiCheatViolation.DUPLICATE_REPLAY,
        message: 'Replay hash already used by another player',
      };
    }

    return { valid: true };
  }
}
