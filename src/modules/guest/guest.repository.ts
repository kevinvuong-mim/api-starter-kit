import { Injectable } from '@nestjs/common';
import { GuestPlayer } from '@prisma/client';

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
}
