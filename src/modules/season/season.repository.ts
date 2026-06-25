import { Injectable } from '@nestjs/common';
import { Season } from '@prisma/client';

import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class SeasonRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveWeekly(gameId: string): Promise<Season | null> {
    return this.prisma.season.findFirst({
      where: { gameId, endAt: null },
      orderBy: { startAt: 'desc' },
    });
  }

  createWeekly(gameId: string, startAt = new Date()): Promise<Season> {
    return this.prisma.season.create({
      data: {
        gameId,
        startAt,
      },
    });
  }

  closeSeason(seasonId: string, endAt = new Date()): Promise<Season> {
    return this.prisma.season.update({
      where: { id: seasonId },
      data: { endAt },
    });
  }

  findAllActiveWeekly(): Promise<Season[]> {
    return this.prisma.season.findMany({
      where: { endAt: null },
      orderBy: { startAt: 'asc' },
    });
  }

  findActiveWeeklyByGameIds(gameIds: string[]): Promise<Season[]> {
    if (gameIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.season.findMany({
      where: {
        gameId: { in: gameIds },
        endAt: null,
      },
      orderBy: { startAt: 'asc' },
    });
  }
}
