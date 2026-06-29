import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/modules/prisma/prisma.service';
import { GameResultDto } from '@/modules/game/dto/sync-game-results.dto';

export interface ReplayResultOwner {
  replayHash: string;
  guestId: string;
  score: number;
}

export interface LeaderboardPageEntry {
  rank: number;
  score: number;
  guestId: string;
}

@Injectable()
export class GameRepository {
  constructor(private readonly prisma: PrismaService) {}

  findReplayResults(gameId: string, replayHashes: string[]) {
    if (replayHashes.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.gameResult.findMany({
      where: {
        gameId,
        replayHash: { in: replayHashes },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        replayHash: true,
        guestId: true,
        score: true,
      },
    });
  }

  async insertResultsBatch(gameId: string, guestId: string, results: GameResultDto[]) {
    if (results.length === 0) {
      return [];
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.gameResult.createMany({
        data: results.map((input) => ({
          gameId,
          guestId,
          score: input.score,
          replayHash: input.replayHash,
          playedAt: input.playedAt ? new Date(input.playedAt) : undefined,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        })),
      });

      const insertedResults = results.map((result) => ({
        replayHash: result.replayHash,
        guestId,
        score: result.score,
      }));

      const bestScore = Math.max(...insertedResults.map((result) => result.score), 0);
      if (bestScore > 0) {
        await tx.$executeRaw`
          INSERT INTO "leaderboard" ("gameId", "guestId", "bestScore", "updatedAt")
          VALUES (${gameId}, ${guestId}, ${bestScore}, NOW())
          ON CONFLICT ("gameId", "guestId")
          DO UPDATE SET
            "bestScore" = GREATEST("leaderboard"."bestScore", EXCLUDED."bestScore"),
            "updatedAt" = NOW()
        `;
      }

      return insertedResults;
    });
  }

  getLeaderboardCount(gameId: string) {
    return this.prisma.leaderboard.count({ where: { gameId } });
  }

  async getBestScoreForGuest(gameId: string, guestId: string) {
    return this.prisma.leaderboard
      .findUnique({
        where: { gameId_guestId: { gameId, guestId } },
        select: { bestScore: true },
      })
      .then((entry) => entry?.bestScore ?? 0);
  }

  async getPlayerRank(gameId: string, guestId: string) {
    const entry = await this.prisma.leaderboard.findUnique({
      where: { gameId_guestId: { gameId, guestId } },
      select: { bestScore: true, guestId: true },
    });

    if (!entry) {
      return null;
    }

    const rows = await this.prisma.$queryRaw<[{ rank: bigint }]>`
      SELECT COUNT(*)::bigint + 1 AS rank
      FROM "leaderboard"
      WHERE "gameId" = ${gameId}
        AND (
          "bestScore" > ${entry.bestScore}
          OR ("bestScore" = ${entry.bestScore} AND "guestId" < ${entry.guestId})
        )
    `;

    return Number(rows[0].rank);
  }

  async getAllLeaderboardEntries(gameId: string) {
    return this.prisma.leaderboard
      .findMany({
        where: { gameId },
        orderBy: [{ bestScore: 'desc' }, { guestId: 'asc' }],
        select: { guestId: true, bestScore: true },
      })
      .then((entries) =>
        entries.map((entry) => ({
          guestId: entry.guestId,
          bestScore: entry.bestScore,
        })),
      );
  }

  async getLeaderboardEntriesPage(gameId: string, limit: number, offset: number) {
    return this.prisma.leaderboard
      .findMany({
        skip: offset,
        take: limit,
        where: { gameId },
        orderBy: [{ bestScore: 'desc' }, { guestId: 'asc' }],
        select: { guestId: true, bestScore: true },
      })
      .then((entries) =>
        entries.map((entry, index) => ({
          guestId: entry.guestId,
          score: entry.bestScore,
          rank: offset + index + 1,
        })),
      );
  }
}
