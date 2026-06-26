import { Injectable } from '@nestjs/common';
import { Prisma, AdRewardSession, AdRewardSessionStatus } from '@prisma/client';

import { PrismaService } from '@/modules/prisma/prisma.service';
import type { AdsRuntimeConfig } from '@/modules/ads/ads.types';

export interface CreateRewardSessionInput {
  expiresAt: Date;
  guestId: string;
  placement: string;
  rewardType: string;
  rewardAmount: number;
}

export interface LogAdEventInput {
  event: string;
  guestId?: string;
  provider?: string;
  placement?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AdsRepository {
  constructor(private readonly prisma: PrismaService) {}

  getConfig(): Promise<{ config: unknown } | null> {
    return this.prisma.adConfig.findUnique({ where: { id: 'default' } });
  }

  upsertConfig(config: AdsRuntimeConfig): Promise<{ config: unknown }> {
    return this.prisma.adConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', config: config as unknown as Prisma.InputJsonValue },
      update: { config: config as unknown as Prisma.InputJsonValue },
    });
  }

  createRewardSession(input: CreateRewardSessionInput): Promise<AdRewardSession> {
    return this.prisma.adRewardSession.create({
      data: {
        guestId: input.guestId,
        expiresAt: input.expiresAt,
        placement: input.placement,
        rewardType: input.rewardType,
        rewardAmount: input.rewardAmount,
        status: AdRewardSessionStatus.PENDING,
      },
    });
  }

  findRewardSessionById(id: string): Promise<AdRewardSession | null> {
    return this.prisma.adRewardSession.findUnique({ where: { id } });
  }

  findRecentRewardSession(
    guestId: string,
    placement: string,
    since: Date,
  ): Promise<AdRewardSession | null> {
    return this.prisma.adRewardSession.findFirst({
      orderBy: { claimedAt: 'desc' },
      where: {
        guestId,
        placement,
        claimedAt: { gte: since },
        status: AdRewardSessionStatus.CLAIMED,
      },
    });
  }

  claimRewardSession(
    id: string,
    provider: string,
    idempotencyKey: string,
  ): Promise<AdRewardSession | null> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.adRewardSession.findUnique({ where: { id } });
      if (!session || session.status !== AdRewardSessionStatus.PENDING) {
        return null;
      }

      if (session.expiresAt < new Date()) {
        await tx.adRewardSession.update({
          where: { id },
          data: { status: AdRewardSessionStatus.EXPIRED },
        });
        return null;
      }

      const existing = await tx.adRewardSession.findUnique({
        where: { idempotencyKey },
      });
      if (existing && existing.id !== id) {
        return null;
      }

      return tx.adRewardSession.update({
        where: { id },
        data: {
          provider,
          idempotencyKey,
          claimedAt: new Date(),
          status: AdRewardSessionStatus.CLAIMED,
        },
      });
    });
  }

  expirePendingSessions(): Promise<number> {
    return this.prisma.adRewardSession
      .updateMany({
        where: {
          status: AdRewardSessionStatus.PENDING,
          expiresAt: { lt: new Date() },
        },
        data: { status: AdRewardSessionStatus.EXPIRED },
      })
      .then((result) => result.count);
  }

  logEvent(input: LogAdEventInput): Promise<void> {
    return this.prisma.adEvent
      .create({
        data: {
          event: input.event,
          guestId: input.guestId,
          metadata: input.metadata,
          provider: input.provider,
          placement: input.placement,
        },
      })
      .then(() => undefined);
  }

  countEventsSince(event: string, since: Date): Promise<number> {
    return this.prisma.adEvent.count({
      where: { event, createdAt: { gte: since } },
    });
  }

  countDistinctGuestsSince(since: Date): Promise<number> {
    return this.prisma.adEvent
      .groupBy({
        by: ['guestId'],
        where: { guestId: { not: null }, createdAt: { gte: since } },
      })
      .then((groups) => groups.length);
  }

  countEventsByTypeSince(events: string[], since: Date): Promise<Record<string, number>> {
    return Promise.all(
      events.map(async (event) => ({
        event,
        count: await this.countEventsSince(event, since),
      })),
    ).then((rows) =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.event] = row.count;
        return acc;
      }, {}),
    );
  }
}
