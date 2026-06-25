import { Injectable } from '@nestjs/common';
import { GameResult, Prisma } from '@prisma/client';

import { PrismaService } from '@/modules/prisma/prisma.service';
import { GameResultInput } from '@/modules/anti-cheat/anti-cheat.types';

@Injectable()
export class GameSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByReplayHash(replayHash: string): Promise<GameResult | null> {
    return this.prisma.gameResult.findUnique({ where: { replayHash } });
  }

  createResult(
    guestId: string,
    input: GameResultInput,
    createdAt?: Date,
  ): Promise<GameResult> {
    return this.prisma.gameResult.create({
      data: {
        guestId,
        score: input.score,
        duration: input.duration,
        seed: input.seed,
        moves: input.moves as Prisma.InputJsonValue,
        replayHash: input.replayHash,
        clientVersion: input.clientVersion,
        createdAt: createdAt ?? new Date(),
        synced: true,
      },
    });
  }

  getBestScoreForGuest(guestId: string): Promise<number> {
    return this.prisma.gameResult
      .aggregate({
        where: { guestId },
        _max: { score: true },
      })
      .then((result) => result._max.score ?? 0);
  }
}
