import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/modules/prisma/prisma.service';

export interface GuestCredentials {
  guestId: string;
}

@Injectable()
export class GuestRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.guestPlayer.findUnique({ where: { id } });
  }

  findByInstallId(installId: string) {
    return this.prisma.guestPlayer.findUnique({ where: { installId } });
  }

  async create(installId?: string) {
    const guest = await this.prisma.guestPlayer.create({
      data: {
        installId,
      },
    });

    return {
      guestId: guest.id,
    };
  }

  updateName(id: string, name: string) {
    return this.prisma.guestPlayer.update({ where: { id }, data: { name } });
  }
}
