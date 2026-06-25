import { Injectable } from '@nestjs/common';
import { GameResult, Prisma } from '@prisma/client';

import { PrismaService } from '@/modules/prisma/prisma.service';
import { GameResultDto } from '@/modules/game/dto/sync-game-results.dto';

@Injectable()
export class GameRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByReplayHash(gameId: string, replayHash: string): Promise<GameResult | null> {
    return this.prisma.gameResult.findUnique({
      where: {
        gameId_replayHash: { gameId, replayHash },
      },
    });
  }

  createResult(
    gameId: string,
    guestId: string,
    input: GameResultDto,
  ): Promise<GameResult> {
    return this.prisma.gameResult.create({
      data: {
        gameId,
        guestId,
        score: input.score,
        duration: input.duration,
        replayHash: input.replayHash,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  getBestScoreForGuest(gameId: string, guestId: string): Promise<number> {
    return this.prisma.leaderboardGlobal
      .findUnique({
        where: { gameId_guestId: { gameId, guestId } },
        select: { bestScore: true },
      })
      .then((entry) => entry?.bestScore ?? 0);
  }
}
