import { Injectable } from '@nestjs/common';
import { GameId, Prisma } from '@prisma/client';

import { PrismaService } from '@/modules/prisma/prisma.service';
import type { SubmitResultDto } from '@/modules/results/dto/submit-result.dto';

export interface ValidatedResultItem extends SubmitResultDto {
  replayHash: string;
}

@Injectable()
export class ResultsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findExistingClientResultIds(gameId: GameId, guestId: string, clientResultIds: string[]) {
    if (clientResultIds.length === 0) {
      return Promise.resolve([] as string[]);
    }

    return this.prisma.gameResult
      .findMany({
        where: {
          gameId,
          guestId,
          clientResultId: { in: clientResultIds },
        },
        select: { clientResultId: true },
      })
      .then((rows) => rows.map((row) => row.clientResultId));
  }

  async insertResults(
    gameId: GameId,
    guestId: string,
    items: ValidatedResultItem[],
  ): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    const data: Prisma.GameResultCreateManyInput[] = items.map((item) => ({
      gameId,
      guestId,
      score: item.score,
      replayHash: item.replayHash,
      clientResultId: item.clientResultId,
      metadata: item.metadata as Prisma.InputJsonValue | undefined,
      playedAt: item.playedAt ? new Date(item.playedAt) : undefined,
    }));

    const result = await this.prisma.gameResult.createMany({ data });

    return result.count;
  }

  async upsertLeaderboardBestScore(gameId: GameId, guestId: string, score: number) {
    await this.prisma.$executeRaw`
      INSERT INTO leaderboards ("gameId", "guestId", "bestScore", "updatedAt")
      VALUES (${gameId}::"GameId", ${guestId}, ${score}, now())
      ON CONFLICT ("gameId", "guestId")
      DO UPDATE SET
        "bestScore" = GREATEST(leaderboards."bestScore", EXCLUDED."bestScore"),
        "updatedAt" = now()
      WHERE EXCLUDED."bestScore" > leaderboards."bestScore"
    `;

    const row = await this.prisma.leaderboard.findUnique({
      where: { gameId_guestId: { gameId, guestId } },
      select: { bestScore: true },
    });

    return row?.bestScore ?? score;
  }

  getTopLeaderboardEntries(gameId: GameId, limit: number) {
    return this.prisma.leaderboard.findMany({
      where: { gameId },
      orderBy: [{ bestScore: 'desc' }],
      take: limit,
      select: { guestId: true, bestScore: true },
    });
  }

  countLeaderboard(gameId: GameId) {
    return this.prisma.leaderboard.count({ where: { gameId } });
  }

  getGuestBestScore(gameId: GameId, guestId: string) {
    return this.prisma.leaderboard.findUnique({
      where: { gameId_guestId: { gameId, guestId } },
      select: { bestScore: true },
    });
  }

  countBetterScores(gameId: GameId, bestScore: number) {
    return this.prisma.leaderboard.count({
      where: {
        gameId,
        bestScore: { gt: bestScore },
      },
    });
  }
}
