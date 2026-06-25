import { Injectable } from '@nestjs/common';
import { GuestPlayer, GuestStatus } from '@prisma/client';

import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class GuestRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(): Promise<GuestPlayer> {
    return this.prisma.guestPlayer.create({ data: {} });
  }

  findById(id: string): Promise<GuestPlayer | null> {
    return this.prisma.guestPlayer.findUnique({ where: { id } });
  }

  updateLastActive(id: string): Promise<GuestPlayer> {
    return this.prisma.guestPlayer.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });
  }

  applyTrustPenalty(id: string, penalty: number): Promise<GuestPlayer> {
    return this.prisma.$transaction(async (tx) => {
      const guest = await tx.guestPlayer.findUniqueOrThrow({ where: { id } });
      const trustScore = Math.max(0, guest.trustScore - penalty);

      let status = guest.status;
      if (trustScore < 20) {
        status = GuestStatus.BLOCKED;
      } else if (trustScore < 60) {
        status = GuestStatus.SHADOW;
      }

      return tx.guestPlayer.update({
        where: { id },
        data: { trustScore, status },
      });
    });
  }

  findEligibleForLeaderboard(ids: string[]): Promise<GuestPlayer[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.guestPlayer.findMany({
      where: {
        id: { in: ids },
        status: GuestStatus.NORMAL,
      },
    });
  }
}
