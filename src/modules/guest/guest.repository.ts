import { Injectable } from '@nestjs/common';
import { GuestPlayer } from '@prisma/client';

import { PrismaService } from '@/modules/prisma/prisma.service';

export interface GuestCredentials {
  guestId: string;
}

@Injectable()
export class GuestRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<GuestPlayer | null> {
    return this.prisma.guestPlayer.findUnique({ where: { id } });
  }

  findByInstallId(installId: string): Promise<GuestPlayer | null> {
    return this.prisma.guestPlayer.findUnique({ where: { installId } });
  }

  async create(installId?: string): Promise<GuestCredentials> {
    const guest = await this.prisma.guestPlayer.create({
      data: {
        installId,
      },
    });

    return {
      guestId: guest.id,
    };
  }

  updateName(id: string, name: string): Promise<GuestPlayer> {
    return this.prisma.guestPlayer.update({ where: { id }, data: { name } });
  }
}
