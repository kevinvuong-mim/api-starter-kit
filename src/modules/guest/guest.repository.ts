import { Injectable } from '@nestjs/common';
import { GuestPlayer } from '@prisma/client';

import { PrismaService } from '@/modules/prisma/prisma.service';
import { APP_CONFIG } from '@/common/config/app.config';
import { hashInstallSecret, generateInstallSecret } from '@/common/utils/install-secret.util';
import {
  hashSessionToken,
  generateSessionToken,
  getSessionTokenExpiry,
} from '@/common/utils/session-token.util';

export interface GuestCredentials {
  guestId: string;
  sessionToken: string;
  sessionTokenExpiresAt: Date;
  installSecret?: string;
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

  findBySessionTokenHash(sessionTokenHash: string): Promise<GuestPlayer | null> {
    return this.prisma.guestPlayer.findUnique({ where: { sessionTokenHash } });
  }

  async create(installId?: string): Promise<GuestCredentials> {
    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);
    const sessionTokenExpiresAt = getSessionTokenExpiry(APP_CONFIG.sessionTokenTtlDays);

    let installSecret: string | undefined;
    let installSecretHash: string | undefined;

    if (installId) {
      installSecret = generateInstallSecret();
      installSecretHash = hashInstallSecret(installSecret);
    }

    const guest = await this.prisma.guestPlayer.create({
      data: {
        installId,
        installSecretHash,
        sessionTokenHash,
        sessionTokenExpiresAt,
      },
    });

    return {
      guestId: guest.id,
      sessionToken,
      sessionTokenExpiresAt,
      installSecret,
    };
  }

  async rotateSessionToken(guestId: string): Promise<GuestCredentials> {
    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);
    const sessionTokenExpiresAt = getSessionTokenExpiry(APP_CONFIG.sessionTokenTtlDays);

    const guest = await this.prisma.guestPlayer.update({
      where: { id: guestId },
      data: {
        sessionTokenHash,
        sessionTokenExpiresAt,
      },
    });

    return {
      guestId: guest.id,
      sessionToken,
      sessionTokenExpiresAt,
    };
  }

  updateName(id: string, name: string): Promise<GuestPlayer> {
    return this.prisma.guestPlayer.update({ where: { id }, data: { name } });
  }
}
