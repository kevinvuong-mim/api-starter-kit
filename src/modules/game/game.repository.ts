import { Injectable } from '@nestjs/common';
import { GameReplayKey, Prisma } from '@prisma/client';

import { PrismaService } from '@/modules/prisma/prisma.service';
import { GameResultDto } from '@/modules/game/dto/sync-game-results.dto';

export interface InsertedReplayKey {
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

  findReplayKeys(gameId: string, replayHashes: string[]): Promise<GameReplayKey[]> {
    if (replayHashes.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.gameReplayKey.findMany({
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
  ): Promise<InsertedReplayKey[]> {
    if (results.length === 0) {
      return [];
    }

    return this.prisma.$transaction(async (tx) => {
      const insertedKeys: InsertedReplayKey[] = [];

      for (const input of results) {
        const rows = await tx.$queryRaw<InsertedReplayKey[]>`
          INSERT INTO "game_replay_keys" ("gameId", "replayHash", "guestId", "score")
          VALUES (${gameId}, ${input.replayHash}, ${guestId}, ${input.score})
          ON CONFLICT ("gameId", "replayHash") DO NOTHING
          RETURNING "replayHash", "guestId", "score"
        `;

        if (rows.length > 0) {
          insertedKeys.push(rows[0]);
        }
      }

      if (insertedKeys.length > 0) {
        await tx.gameResult.createMany({
          data: insertedKeys.map((key) => {
            const input = results.find((result) => result.replayHash === key.replayHash)!;
            return {
              gameId,
              guestId,
              score: key.score,
              replayHash: key.replayHash,
              playedAt: input.playedAt ? new Date(input.playedAt) : undefined,
              metadata: input.metadata as Prisma.InputJsonValue | undefined,
            };
          }),
        });
      }

      const bestScore = Math.max(...insertedKeys.map((key) => key.score), 0);
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

      return insertedKeys;
    });
  }

  getLeaderboardCount(gameId: string): Promise<number> {
    return this.prisma.leaderboard.count({ where: { gameId } });
  }

  getBestScoreForGuest(gameId: string, guestId: string): Promise<number> {
    return this.prisma.leaderboard
      .findUnique({
        where: { gameId_guestId: { gameId, guestId } },
        select: { bestScore: true },
      })
      .then((entry) => entry?.bestScore ?? 0);
  }

  async getPlayerRank(gameId: string, guestId: string): Promise<number | null> {
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

  getAllLeaderboardEntries(gameId: string): Promise<Array<{ guestId: string; bestScore: number }>> {
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

  getLeaderboardEntriesPage(
    gameId: string,
    limit: number,
    offset: number,
  ): Promise<LeaderboardPageEntry[]> {
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
