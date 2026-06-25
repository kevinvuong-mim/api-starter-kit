import { Injectable } from '@nestjs/common';
import { Season, SeasonType } from '@prisma/client';

import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class SeasonRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveWeekly(): Promise<Season | null> {
    return this.prisma.season.findFirst({
      where: { type: SeasonType.WEEKLY, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  }

  createWeekly(startedAt = new Date()): Promise<Season> {
    return this.prisma.season.create({
      data: {
        type: SeasonType.WEEKLY,
        startedAt,
      },
    });
  }

  closeSeason(seasonId: string, endedAt = new Date()): Promise<Season> {
    return this.prisma.season.update({
      where: { id: seasonId },
      data: { endedAt },
    });
  }

  findById(seasonId: string): Promise<Season | null> {
    return this.prisma.season.findUnique({ where: { id: seasonId } });
  }

  findAllActiveWeekly(): Promise<Season[]> {
    return this.prisma.season.findMany({
      where: { type: SeasonType.WEEKLY, endedAt: null },
      orderBy: { startedAt: 'asc' },
    });
  }
}
