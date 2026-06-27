import { Injectable } from '@nestjs/common';
import { GameResult, Prisma } from '@prisma/client';

import { PrismaService } from '@/modules/prisma/prisma.service';
import { GameResultDto } from '@/modules/game/dto/sync-game-results.dto';

@Injectable()
export class GameRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByReplayHashes(gameId: string, replayHashes: string[]): Promise<GameResult[]> {
    if (replayHashes.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.gameResult.findMany({
      where: {
        gameId,
        replayHash: { in: replayHashes },
      },
    });
  }

  async insertResultsBatch(
    gameId: string,
    guestId: string,
    results: GameResultDto[],
  ): Promise<GameResult[]> {
    if (results.length === 0) {
      return [];
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.gameResult.createMany({
        skipDuplicates: true,
        data: results.map((input) => ({
          gameId,
          guestId,
          score: input.score,
          replayHash: input.replayHash,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        })),
      });

      const inserted = await tx.gameResult.findMany({
        where: {
          gameId,
          guestId,
          replayHash: { in: results.map((result) => result.replayHash) },
        },
      });

      for (const row of inserted) {
        await tx.$executeRaw`
          INSERT INTO "leaderboard" ("gameId", "guestId", "bestScore", "updatedAt")
          VALUES (${gameId}, ${guestId}, ${row.score}, NOW())
          ON CONFLICT ("gameId", "guestId")
          DO UPDATE SET
            "bestScore" = GREATEST("leaderboard"."bestScore", EXCLUDED."bestScore"),
            "updatedAt" = NOW()
        `;
      }

      return inserted;
    });
  }

  getBestScoreForGuest(gameId: string, guestId: string): Promise<number> {
    return this.prisma.leaderboard
      .findUnique({
        where: { gameId_guestId: { gameId, guestId } },
        select: { bestScore: true },
      })
      .then((entry) => entry?.bestScore ?? 0);
  }

  // Atomic upsert: giữ score cao nhất ở mức DB qua ON CONFLICT + GREATEST,
  // tránh race read-then-write khi nhiều request ghi đồng thời.
  async upsertLeaderboardBest(gameId: string, guestId: string, score: number): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "leaderboard" ("gameId", "guestId", "bestScore", "updatedAt")
      VALUES (${gameId}, ${guestId}, ${score}, NOW())
      ON CONFLICT ("gameId", "guestId")
      DO UPDATE SET
        "bestScore" = GREATEST("leaderboard"."bestScore", EXCLUDED."bestScore"),
        "updatedAt" = NOW()
    `;
  }
}
