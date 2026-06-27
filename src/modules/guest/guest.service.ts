import { GuestPlayer, Prisma } from '@prisma/client';
import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';

import { GuestRepository } from '@/modules/guest/guest.repository';
import { hashSessionToken } from '@/common/utils/session-token.util';
import { verifyInstallSecret } from '@/common/utils/install-secret.util';
import { InitGuestDto } from '@/modules/guest/dto/init-guest.dto';
import { GuestProfileResponseDto } from '@/modules/guest/dto/guest-profile-response.dto';
import { InitGuestResponseDto } from '@/modules/guest/dto/init-guest-response.dto';

@Injectable()
export class GuestService {
  constructor(private readonly guestRepository: GuestRepository) {}

  async initializeGuest(dto: InitGuestDto): Promise<InitGuestResponseDto> {
    const { installId, installSecret } = dto;

    if (installId) {
      const existing = await this.guestRepository.findByInstallId(installId);
      if (existing) {
        return this.relinkExistingGuest(existing, installSecret);
      }
    }

    try {
      const credentials = await this.guestRepository.create(installId);
      return {
        guestId: credentials.guestId,
        sessionToken: credentials.sessionToken,
        sessionTokenExpiresAt: credentials.sessionTokenExpiresAt.toISOString(),
        relinked: false,
        installSecret: credentials.installSecret,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Lost a concurrent init race for the same installId. Re-read the winning row and
        // relink instead of failing, so a double-submit from the same device recovers
        // (with installSecret) rather than getting permanently locked out.
        if (installId) {
          const existing = await this.guestRepository.findByInstallId(installId);
          if (existing) {
            return this.relinkExistingGuest(existing, installSecret);
          }
        }

        throw new ConflictException(
          'installId already registered; provide installSecret to relink',
        );
      }

      throw error;
    }
  }

  getProfile(guest: GuestPlayer): GuestProfileResponseDto {
    return {
      guestId: guest.id,
      name: guest.name,
      sessionTokenExpiresAt: guest.sessionTokenExpiresAt.toISOString(),
    };
  }

  async getGuestBySessionToken(sessionToken: string): Promise<GuestPlayer | undefined> {
    const guest = await this.guestRepository.findBySessionTokenHash(hashSessionToken(sessionToken));
    if (!guest) {
      return undefined;
    }

    return this.assertSessionActive(guest);
  }

  async getGuestBySessionTokenOrThrow(sessionToken: string): Promise<GuestPlayer> {
    const guest = await this.getGuestBySessionToken(sessionToken);
    if (!guest) {
      throw new UnauthorizedException('Invalid or expired session token');
    }

    return guest;
  }

  async updateName(guest: GuestPlayer, name: string): Promise<GuestProfileResponseDto> {
    const updated = await this.guestRepository.updateName(guest.id, name);
    return {
      guestId: updated.id,
      name: updated.name,
      sessionTokenExpiresAt: updated.sessionTokenExpiresAt.toISOString(),
    };
  }

  private async relinkExistingGuest(
    existing: GuestPlayer,
    installSecret?: string,
  ): Promise<InitGuestResponseDto> {
    if (!existing.installSecretHash) {
      throw new UnauthorizedException(
        'Guest was created before installSecret support; create a new guest or contact support',
      );
    }

    if (!installSecret) {
      throw new UnauthorizedException('installSecret is required to relink an existing guest');
    }

    if (!verifyInstallSecret(installSecret, existing.installSecretHash)) {
      throw new UnauthorizedException('Invalid install credentials');
    }

    const credentials = await this.guestRepository.rotateSessionToken(existing.id);
    return {
      guestId: credentials.guestId,
      sessionToken: credentials.sessionToken,
      sessionTokenExpiresAt: credentials.sessionTokenExpiresAt.toISOString(),
      relinked: true,
    };
  }

  private assertSessionActive(guest: GuestPlayer): GuestPlayer | undefined {
    if (guest.sessionTokenExpiresAt.getTime() <= Date.now()) {
      return undefined;
    }

    return guest;
  }
}
